import type { Prisma, ReviewStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { ReviewSort } from "@/types/review";

const withAuthorName = { user: { select: { name: true } } } satisfies Prisma.ReviewInclude;

export type ReviewWithAuthor = Prisma.ReviewGetPayload<{ include: typeof withAuthorName }>;

export interface PublishedReviewQuery {
  sort: ReviewSort;
  rating?: number;
  skip: number;
  take: number;
}

export interface ReviewStatusUpdate {
  status: ReviewStatus;
  publishedAt?: Date;
  reviewedById?: string;
  reviewedAt?: Date;
  moderatorNote?: string;
}

// Every sort ends with publishedAt desc, then id, so ties are broken the same
// way on every request and pagination never repeats or skips a review.
const orderBySort: Record<ReviewSort, Prisma.ReviewOrderByWithRelationInput[]> = {
  recent: [{ publishedAt: "desc" }, { id: "asc" }],
  highest: [{ rating: "desc" }, { publishedAt: "desc" }, { id: "asc" }],
  lowest: [{ rating: "asc" }, { publishedAt: "desc" }, { id: "asc" }],
};

export function createReview(data: Prisma.ReviewUncheckedCreateInput) {
  return prisma.review.create({ data });
}

export function findReviewById(id: string) {
  return prisma.review.findUnique({ where: { id } });
}

export function findReviewByProductAndUser(productId: string, userId: string) {
  return prisma.review.findUnique({ where: { productId_userId: { productId, userId } } });
}

/**
 * Writes are conditional on the review still being the caller's own Pending
 * review, so a moderator publishing the review concurrently can't have its
 * content overwritten (which would also leave `ProductRatingSummary` stale,
 * since a content edit never recalculates it). Returns `null` when no row
 * matched (already left Pending, or wrong user) instead of throwing, so the
 * service can tell that apart from a real not-found.
 */
export async function updateOwnPendingReviewContent(
  id: string,
  userId: string,
  data: { rating: number; title: string; body: string },
) {
  const { count } = await prisma.review.updateMany({
    where: { id, userId, status: "Pending" },
    data,
  });
  if (count === 0) return null;
  return prisma.review.findUnique({ where: { id } });
}

/** Same conditional guard as `updateOwnPendingReviewContent`; see its comment. */
export async function deleteOwnPendingReview(id: string, userId: string): Promise<boolean> {
  const { count } = await prisma.review.deleteMany({ where: { id, userId, status: "Pending" } });
  return count > 0;
}

export async function listPublishedReviews(
  productId: string,
  query: PublishedReviewQuery,
): Promise<{ items: ReviewWithAuthor[]; total: number }> {
  const where: Prisma.ReviewWhereInput = {
    productId,
    status: "Published",
    ...(query.rating ? { rating: query.rating } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: orderBySort[query.sort],
      skip: query.skip,
      take: query.take,
      include: withAuthorName,
    }),
    prisma.review.count({ where }),
  ]);
  return { items, total };
}

export function findRatingSummary(productId: string) {
  return prisma.productRatingSummary.findUnique({ where: { productId } });
}

async function recalculateRatingSummary(tx: Prisma.TransactionClient, productId: string): Promise<void> {
  const groups = await tx.review.groupBy({
    by: ["rating"],
    where: { productId, status: "Published" },
    _count: { _all: true },
  });
  const countFor = (star: number) => groups.find((group) => group.rating === star)?._count._all ?? 0;
  const counts = { count1: countFor(1), count2: countFor(2), count3: countFor(3), count4: countFor(4), count5: countFor(5) };
  const reviewCount = counts.count1 + counts.count2 + counts.count3 + counts.count4 + counts.count5;

  if (reviewCount === 0) {
    await tx.productRatingSummary.deleteMany({ where: { productId } });
    return;
  }

  const ratingTotal = counts.count1 + 2 * counts.count2 + 3 * counts.count3 + 4 * counts.count4 + 5 * counts.count5;
  const data = { ...counts, reviewCount, averageRating: (ratingTotal / reviewCount).toFixed(2) };
  await tx.productRatingSummary.upsert({
    where: { productId },
    create: { productId, ...data },
    update: data,
  });
}

/**
 * Changes a review's status and, when `recalculate` is true, rebuilds the
 * product's rating summary in the same transaction, so the summary can never
 * disagree with the Published reviews. review.service.ts decides whether a
 * recalculation is needed (only when the review enters or leaves Published).
 *
 * Two concurrent transactions recalculating the same product's summary would
 * otherwise both read the pre-change `groupBy` under READ COMMITTED and each
 * overwrite the other's upsert. `SELECT ... FOR UPDATE` on the product row
 * serialises them: the second transaction blocks until the first commits, so
 * its own `groupBy` sees the first transaction's status change. The status
 * write itself is conditional on `fromStatus` (`updateMany`, not `update`),
 * so a status change that raced ahead of the caller's stale read is detected
 * (`count === 0`) instead of silently overwritten; the caller re-reads and
 * retries via a fresh `changeReviewStatus` call rather than this function
 * looping.
 */
export function updateStatusAndRecalculate(
  reviewId: string,
  productId: string,
  fromStatus: ReviewStatus,
  data: ReviewStatusUpdate,
  recalculate: boolean,
) {
  return prisma.$transaction(async (tx) => {
    if (recalculate) {
      await tx.$queryRaw`SELECT 1 FROM "Product" WHERE "id" = ${productId} FOR UPDATE`;
    }
    const { count } = await tx.review.updateMany({ where: { id: reviewId, status: fromStatus }, data });
    if (count === 0) return null;
    if (recalculate) await recalculateRatingSummary(tx, productId);
    return tx.review.findUnique({ where: { id: reviewId } });
  });
}
