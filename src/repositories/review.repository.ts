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

export function updateReviewContent(id: string, data: { rating: number; title: string; body: string }) {
  return prisma.review.update({ where: { id }, data });
}

export function deleteReview(id: string) {
  return prisma.review.delete({ where: { id } });
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
 */
export function updateStatusAndRecalculate(
  reviewId: string,
  productId: string,
  data: ReviewStatusUpdate,
  recalculate: boolean,
) {
  return prisma.$transaction(async (tx) => {
    const review = await tx.review.update({ where: { id: reviewId }, data });
    if (recalculate) await recalculateRatingSummary(tx, productId);
    return review;
  });
}
