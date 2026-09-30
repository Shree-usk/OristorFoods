import type { Prisma, RecipeReviewStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { RecipeReviewSort } from "@/types/recipe-review";

const withAuthorName = { customer: { select: { name: true } } } satisfies Prisma.RecipeReviewInclude;

export type RecipeReviewWithAuthor = Prisma.RecipeReviewGetPayload<{ include: typeof withAuthorName }>;

export interface ApprovedReviewQuery {
  sort: RecipeReviewSort;
  skip: number;
  take: number;
}

// Every sort ends with id, so ties are broken the same way on every request
// and pagination never repeats or skips a review.
const orderBySort: Record<RecipeReviewSort, Prisma.RecipeReviewOrderByWithRelationInput[]> = {
  recent: [{ createdAt: "desc" }, { id: "asc" }],
  highest: [{ rating: "desc" }, { createdAt: "desc" }, { id: "asc" }],
  lowest: [{ rating: "asc" }, { createdAt: "desc" }, { id: "asc" }],
};

export function createReview(data: Prisma.RecipeReviewUncheckedCreateInput) {
  return prisma.recipeReview.create({ data });
}

export function findReviewById(id: string) {
  return prisma.recipeReview.findUnique({ where: { id } });
}

/** STORY-039. Dashboard's Pending Moderation widget. */
export function countPendingRecipeReviews() {
  return prisma.recipeReview.count({ where: { status: "Pending" } });
}

export function findReviewByRecipeAndCustomer(recipeId: string, customerId: string) {
  return prisma.recipeReview.findUnique({ where: { recipeId_customerId: { recipeId, customerId } } });
}

/**
 * Writes are conditional on the review still being the caller's own Pending
 * review, so a moderator approving/rejecting it concurrently can't have its
 * content overwritten. Returns `null` when no row matched (already left
 * Pending, or wrong customer) instead of throwing, so the service can tell
 * that apart from a real not-found. Mirrors review.repository.ts's
 * updateOwnPendingReviewContent exactly.
 */
export async function updateOwnPendingReviewContent(
  id: string,
  customerId: string,
  data: { rating: number; reviewText: string | null },
) {
  const { count } = await prisma.recipeReview.updateMany({
    where: { id, customerId, status: "Pending" },
    data,
  });
  if (count === 0) return null;
  return prisma.recipeReview.findUnique({ where: { id } });
}

/** Same conditional guard as updateOwnPendingReviewContent; see its comment. */
export async function deleteOwnPendingReview(id: string, customerId: string): Promise<boolean> {
  const { count } = await prisma.recipeReview.deleteMany({ where: { id, customerId, status: "Pending" } });
  return count > 0;
}

export async function listApprovedReviews(
  recipeId: string,
  query: ApprovedReviewQuery,
): Promise<{ items: RecipeReviewWithAuthor[]; total: number }> {
  const where: Prisma.RecipeReviewWhereInput = { recipeId, status: "Approved" };
  const [items, total] = await Promise.all([
    prisma.recipeReview.findMany({
      where,
      orderBy: orderBySort[query.sort],
      skip: query.skip,
      take: query.take,
      include: withAuthorName,
    }),
    prisma.recipeReview.count({ where }),
  ]);
  return { items, total };
}

/**
 * Changes a review's status and, when `recalculate` is true, rebuilds
 * Recipe.avgRating/ratingCount in the same transaction, so the columns can
 * never disagree with the Approved reviews. recipe-review.service.ts decides
 * whether a recalculation is needed (only when the review enters or leaves
 * Approved). See docs/superpowers/specs/2026-09-27-recipe-reviews-bookmarks-design.md
 * decision #2 for why this writes Recipe's own flat columns directly instead
 * of a separate summary table.
 *
 * Two concurrent transactions recalculating the same recipe would otherwise
 * both read the pre-change aggregate under READ COMMITTED and each overwrite
 * the other's update. `SELECT ... FOR UPDATE` on the recipe row serialises
 * them: the second transaction blocks until the first commits, so its own
 * aggregate sees the first transaction's status change. The status write
 * itself is conditional on `fromStatus` (`updateMany`, not `update`), so a
 * status change that raced ahead of the caller's stale read is detected
 * (`count === 0`) instead of silently overwritten. Identical reasoning to
 * review.repository.ts's updateStatusAndRecalculate.
 */
export function updateReviewStatusAndRecalculate(
  reviewId: string,
  recipeId: string,
  fromStatus: RecipeReviewStatus,
  data: Prisma.RecipeReviewUpdateInput,
  recalculate: boolean,
) {
  return prisma.$transaction(async (tx) => {
    if (recalculate) {
      await tx.$queryRaw`SELECT 1 FROM "Recipe" WHERE "id" = ${recipeId} FOR UPDATE`;
    }
    const { count } = await tx.recipeReview.updateMany({ where: { id: reviewId, status: fromStatus }, data });
    if (count === 0) return null;
    if (recalculate) {
      const agg = await tx.recipeReview.aggregate({
        where: { recipeId, status: "Approved" },
        _avg: { rating: true },
        _count: true,
      });
      await tx.recipe.update({
        where: { id: recipeId },
        data: { avgRating: agg._avg.rating ?? null, ratingCount: agg._count },
      });
    }
    return tx.recipeReview.findUnique({ where: { id: reviewId } });
  });
}
