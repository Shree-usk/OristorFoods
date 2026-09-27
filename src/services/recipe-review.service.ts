import { Prisma, type RecipeReviewStatus } from "@/generated/prisma/client";
import { findPublishedRecipeBySlug } from "@/repositories/recipe.repository";
import * as recipeReviewRepository from "@/repositories/recipe-review.repository";
import type { RecipeReviewWithAuthor } from "@/repositories/recipe-review.repository";
import {
  DuplicateRecipeReviewError,
  InvalidRecipeReviewInputError,
  InvalidRecipeReviewTransitionError,
  RecipeNotFoundError,
  RecipeReviewForbiddenError,
  RecipeReviewNotEditableError,
  RecipeReviewNotFoundError,
} from "@/services/recipe-review.errors";
import type { OwnRecipeReview, PublicRecipeReview, RecipeReviewPage } from "@/types/recipe-review";
import { recipeReviewInputSchema, type RecipeReviewInput, type RecipeReviewListQuery } from "@/validation/recipe-review.schema";

// ---------------------------------------------------------------------------
// Status lifecycle — mirrors blog.service.ts's shape exactly (an
// allowedTransitions table + one mutation function), not review.service.ts's
// more complex one: RecipeReview has no separate "Approved but not yet
// published" step (design spec decision #1).
// ---------------------------------------------------------------------------

const allowedTransitions: Record<RecipeReviewStatus, readonly RecipeReviewStatus[]> = {
  Pending: ["Approved", "Rejected"],
  Approved: ["Hidden"],
  Rejected: [],
  Hidden: [],
};

export function canTransitionRecipeReview(from: RecipeReviewStatus, to: RecipeReviewStatus): boolean {
  return allowedTransitions[from].includes(to);
}

export async function changeRecipeReviewStatus(reviewId: string, nextStatus: RecipeReviewStatus) {
  const review = await recipeReviewRepository.findReviewById(reviewId);
  if (!review) throw new RecipeReviewNotFoundError();
  if (!canTransitionRecipeReview(review.status, nextStatus)) {
    throw new InvalidRecipeReviewTransitionError(review.status, nextStatus);
  }

  // Recalculation triggers whenever the transition crosses the Approved
  // boundary in either direction (Pending->Approved, Approved->Hidden).
  // Approved->Rejected is impossible per allowedTransitions above.
  const recalculate = review.status === "Approved" || nextStatus === "Approved";
  const updated = await recipeReviewRepository.updateReviewStatusAndRecalculate(
    review.id,
    review.recipeId,
    review.status,
    { status: nextStatus },
    recalculate,
  );
  if (!updated) throw new InvalidRecipeReviewTransitionError(review.status, nextStatus);
  return updated;
}

// ---------------------------------------------------------------------------
// Customer actions and public listing
// ---------------------------------------------------------------------------

const FALLBACK_AUTHOR_NAME = "Oristor customer";

function toOwnReview(review: {
  id: string;
  rating: number;
  reviewText: string | null;
  status: RecipeReviewStatus;
}): OwnRecipeReview {
  return { id: review.id, rating: review.rating, reviewText: review.reviewText, status: review.status };
}

function toPublicReview(review: RecipeReviewWithAuthor): PublicRecipeReview {
  return {
    id: review.id,
    authorName: review.customer.name?.trim() || FALLBACK_AUTHOR_NAME,
    rating: review.rating,
    reviewText: review.reviewText,
    createdAt: review.createdAt.toISOString(),
  };
}

async function requirePublishedRecipe(slug: string) {
  const recipe = await findPublishedRecipeBySlug(slug);
  if (!recipe) throw new RecipeNotFoundError();
  return recipe;
}

// Route handlers already validate with the same schema; this second check
// protects non-API callers (the seed, e2e helpers, future jobs).
function parseReviewInput(input: RecipeReviewInput): RecipeReviewInput {
  const parsed = recipeReviewInputSchema.safeParse(input);
  if (!parsed.success) throw new InvalidRecipeReviewInputError(parsed.error.issues[0]?.message ?? "Invalid review");
  return parsed.data;
}

async function requireOwnPendingReview(customerId: string, recipeSlug: string, reviewId: string) {
  const recipe = await requirePublishedRecipe(recipeSlug);
  const review = await recipeReviewRepository.findReviewById(reviewId);
  if (!review || review.recipeId !== recipe.id) throw new RecipeReviewNotFoundError();
  if (review.customerId !== customerId) throw new RecipeReviewForbiddenError();
  if (review.status !== "Pending") throw new RecipeReviewNotEditableError();
  return review;
}

export async function submitReview(customerId: string, recipeSlug: string, input: RecipeReviewInput): Promise<OwnRecipeReview> {
  const recipe = await requirePublishedRecipe(recipeSlug);
  const data = parseReviewInput(input);
  try {
    const review = await recipeReviewRepository.createReview({
      recipeId: recipe.id,
      customerId,
      rating: data.rating,
      reviewText: data.reviewText ?? null,
    });
    return toOwnReview(review);
  } catch (error) {
    // The (recipeId, customerId) unique constraint is the real guard, so two
    // concurrent submits can't both succeed.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DuplicateRecipeReviewError();
    }
    throw error;
  }
}

export async function getMyReview(customerId: string, recipeSlug: string): Promise<OwnRecipeReview | null> {
  const recipe = await requirePublishedRecipe(recipeSlug);
  const review = await recipeReviewRepository.findReviewByRecipeAndCustomer(recipe.id, customerId);
  return review ? toOwnReview(review) : null;
}

export async function editOwnPendingReview(
  customerId: string,
  recipeSlug: string,
  reviewId: string,
  input: RecipeReviewInput,
): Promise<OwnRecipeReview> {
  await requireOwnPendingReview(customerId, recipeSlug, reviewId);
  const data = parseReviewInput(input);
  // Conditional on status = Pending: see updateOwnPendingReviewContent's doc
  // comment in recipe-review.repository.ts — a moderator acting between the
  // read above and this write makes this affect 0 rows instead of silently
  // overwriting Approved/Rejected content.
  const updated = await recipeReviewRepository.updateOwnPendingReviewContent(reviewId, customerId, {
    rating: data.rating,
    reviewText: data.reviewText ?? null,
  });
  if (!updated) throw new RecipeReviewNotEditableError();
  return toOwnReview(updated);
}

/** Withdrawing deletes the review: it was never public, and this frees the one-per-recipe slot. */
export async function withdrawOwnPendingReview(customerId: string, recipeSlug: string, reviewId: string): Promise<void> {
  await requireOwnPendingReview(customerId, recipeSlug, reviewId);
  // Conditional delete: see the comment in editOwnPendingReview above.
  const deleted = await recipeReviewRepository.deleteOwnPendingReview(reviewId, customerId);
  if (!deleted) throw new RecipeReviewNotEditableError();
}

/**
 * id-based primitive, called directly by the recipe detail page (Server
 * Component, Task 11) to seed RecipeReviewsSection's initialData. No
 * provider-registry indirection is needed here (unlike Product's
 * registerReviewSummaryProvider) because Recipe.avgRating/ratingCount are
 * already flat columns recipe.service.ts's getRecipeBySlug returns directly
 * — see design spec decision #9.
 */
export async function listApprovedReviewsForRecipe(recipeId: string, query: RecipeReviewListQuery): Promise<RecipeReviewPage> {
  const { items, total } = await recipeReviewRepository.listApprovedReviews(recipeId, {
    sort: query.sort,
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  });
  return { items: items.map(toPublicReview), total, page: query.page, pageSize: query.pageSize };
}

/** slug-based wrapper, used only by GET /api/recipes/[slug]/reviews (Task 5). */
export async function listApprovedReviews(recipeSlug: string, query: RecipeReviewListQuery): Promise<RecipeReviewPage> {
  const recipe = await requirePublishedRecipe(recipeSlug);
  return listApprovedReviewsForRecipe(recipe.id, query);
}

// ---------------------------------------------------------------------------
// Dev tooling
// ---------------------------------------------------------------------------

/**
 * Walks a Pending review to Approved through the real transition function,
 * for the seed (Task 8) and e2e tests (Task 12) only. In production,
 * reviews are approved from the moderation console (Epic 07, STORY-045).
 */
export function advanceRecipeReviewToApproved(reviewId: string) {
  return changeRecipeReviewStatus(reviewId, "Approved");
}
