import { Prisma, type ReviewStatus } from "@/generated/prisma/client";
import { findProductBySlug } from "@/repositories/product.repository";
import * as reviewRepository from "@/repositories/review.repository";
import type { ReviewStatusUpdate, ReviewWithAuthor } from "@/repositories/review.repository";
import { hasPurchasedProduct } from "@/services/purchase-verification";
import {
  DuplicateReviewError,
  InvalidReviewInputError,
  InvalidReviewTransitionError,
  ProductNotFoundError,
  ReviewForbiddenError,
  ReviewNotEditableError,
  ReviewNotFoundError,
} from "@/services/review.errors";
import type { OwnReview, PublicReview, RatingSummaryData, ReviewPage } from "@/types/review";
import { reviewInputSchema, type ReviewInput, type ReviewListQuery } from "@/validation/review.schema";

// ---------------------------------------------------------------------------
// Status lifecycle (blueprint Section 7: pending → approved → published →
// archived). changeReviewStatus() is the only way a status changes; the
// STORY-045 moderation console calls it.
// ---------------------------------------------------------------------------

const allowedTransitions: Record<ReviewStatus, readonly ReviewStatus[]> = {
  Pending: ["Approved", "Rejected"],
  Approved: ["Published", "Rejected"],
  Published: ["Archived"],
  Archived: ["Published"],
  Rejected: [],
};

export function canTransitionReview(from: ReviewStatus, to: ReviewStatus): boolean {
  return allowedTransitions[from].includes(to);
}

export interface ChangeReviewStatusOptions {
  moderatorId?: string;
  note?: string;
}

export async function changeReviewStatus(
  reviewId: string,
  nextStatus: ReviewStatus,
  options: ChangeReviewStatusOptions = {},
) {
  const review = await reviewRepository.findReviewById(reviewId);
  if (!review) throw new ReviewNotFoundError();
  if (!canTransitionReview(review.status, nextStatus)) {
    throw new InvalidReviewTransitionError(review.status, nextStatus);
  }

  const data: ReviewStatusUpdate = { status: nextStatus };
  if (nextStatus === "Published") data.publishedAt = new Date();
  if (options.moderatorId) {
    data.reviewedById = options.moderatorId;
    data.reviewedAt = new Date();
  }
  if (options.note !== undefined) data.moderatorNote = options.note;

  const touchesPublished = review.status === "Published" || nextStatus === "Published";
  return reviewRepository.updateStatusAndRecalculate(review.id, review.productId, data, touchesPublished);
}

export async function getRatingSummary(productId: string): Promise<RatingSummaryData | null> {
  const row = await reviewRepository.findRatingSummary(productId);
  if (!row) return null;
  return {
    averageRating: row.averageRating.toNumber(),
    reviewCount: row.reviewCount,
    histogram: { 1: row.count1, 2: row.count2, 3: row.count3, 4: row.count4, 5: row.count5 },
  };
}

// ---------------------------------------------------------------------------
// Customer actions and public listing
// ---------------------------------------------------------------------------

const FALLBACK_AUTHOR_NAME = "Oristor customer";

function toOwnReview(review: { id: string; rating: number; title: string; body: string; status: ReviewStatus }): OwnReview {
  return { id: review.id, rating: review.rating, title: review.title, body: review.body, status: review.status };
}

function toPublicReview(review: ReviewWithAuthor): PublicReview {
  return {
    id: review.id,
    authorName: review.user.name?.trim() || FALLBACK_AUTHOR_NAME,
    rating: review.rating,
    title: review.title,
    body: review.body,
    isVerifiedPurchase: review.isVerifiedPurchase,
    publishedAt: (review.publishedAt ?? review.createdAt).toISOString(),
  };
}

async function requirePublishedProduct(productSlug: string) {
  const product = await findProductBySlug(productSlug);
  if (!product || product.status !== "Published") throw new ProductNotFoundError();
  return product;
}

// Route handlers already validate with the same schema; this second check
// protects non-API callers (the seed, the dev publish script, future jobs).
function parseReviewInput(input: ReviewInput): ReviewInput {
  const parsed = reviewInputSchema.safeParse(input);
  if (!parsed.success) throw new InvalidReviewInputError(parsed.error.issues[0]?.message ?? "Invalid review");
  return parsed.data;
}

async function requireOwnPendingReview(userId: string, productSlug: string, reviewId: string) {
  const product = await requirePublishedProduct(productSlug);
  const review = await reviewRepository.findReviewById(reviewId);
  if (!review || review.productId !== product.id) throw new ReviewNotFoundError();
  if (review.userId !== userId) throw new ReviewForbiddenError();
  if (review.status !== "Pending") throw new ReviewNotEditableError();
  return review;
}

export async function submitReview(userId: string, productSlug: string, input: ReviewInput): Promise<OwnReview> {
  const product = await requirePublishedProduct(productSlug);
  const data = parseReviewInput(input);
  const isVerifiedPurchase = await hasPurchasedProduct(userId, product.id);
  try {
    const review = await reviewRepository.createReview({ productId: product.id, userId, ...data, isVerifiedPurchase });
    return toOwnReview(review);
  } catch (error) {
    // The (productId, userId) unique constraint is the real guard, so two
    // concurrent submits can't both succeed.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DuplicateReviewError();
    }
    throw error;
  }
}

export async function getMyReview(userId: string, productSlug: string): Promise<OwnReview | null> {
  const product = await requirePublishedProduct(productSlug);
  const review = await reviewRepository.findReviewByProductAndUser(product.id, userId);
  return review ? toOwnReview(review) : null;
}

export async function editOwnPendingReview(
  userId: string,
  productSlug: string,
  reviewId: string,
  input: ReviewInput,
): Promise<OwnReview> {
  const review = await requireOwnPendingReview(userId, productSlug, reviewId);
  const updated = await reviewRepository.updateReviewContent(review.id, parseReviewInput(input));
  return toOwnReview(updated);
}

/** Withdrawing deletes the review: it was never public, and this frees the one-per-product slot. */
export async function withdrawOwnPendingReview(userId: string, productSlug: string, reviewId: string): Promise<void> {
  const review = await requireOwnPendingReview(userId, productSlug, reviewId);
  await reviewRepository.deleteReview(review.id);
}

export async function listPublishedReviewsForProduct(productId: string, query: ReviewListQuery): Promise<ReviewPage> {
  const { items, total } = await reviewRepository.listPublishedReviews(productId, {
    sort: query.sort,
    rating: query.rating,
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  });
  return { items: items.map(toPublicReview), total, page: query.page, pageSize: query.pageSize };
}

export async function listPublishedReviews(productSlug: string, query: ReviewListQuery): Promise<ReviewPage> {
  const product = await requirePublishedProduct(productSlug);
  return listPublishedReviewsForProduct(product.id, query);
}
