import type { ReviewStatus } from "@/generated/prisma/client";
import * as reviewRepository from "@/repositories/review.repository";
import type { ReviewStatusUpdate } from "@/repositories/review.repository";
import { InvalidReviewTransitionError, ReviewNotFoundError } from "@/services/review.errors";
import type { RatingSummaryData } from "@/types/review";

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
