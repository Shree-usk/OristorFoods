/**
 * Review types and constants shared by server and client code (STORY-015).
 * Keep this file free of server-only imports (Prisma, services): client
 * components import from it.
 */

export type StarRating = 1 | 2 | 3 | 4 | 5;

/** Highest first — the order the histogram is displayed in. */
export const STAR_RATINGS: readonly StarRating[] = [5, 4, 3, 2, 1];

export type RatingHistogram = Record<StarRating, number>;

export interface RatingSummaryData {
  averageRating: number;
  reviewCount: number;
  histogram: RatingHistogram;
}

/** A Published review as returned by the public API and shown on the PDP. */
export interface PublicReview {
  id: string;
  authorName: string;
  rating: number;
  title: string;
  body: string;
  isVerifiedPurchase: boolean;
  /** ISO 8601 string. */
  publishedAt: string;
}

export interface ReviewPage {
  items: PublicReview[];
  total: number;
  page: number;
  pageSize: number;
}

export type ReviewStatusValue = "Pending" | "Approved" | "Published" | "Rejected" | "Archived";

/** The signed-in customer's own review, in any status. */
export interface OwnReview {
  id: string;
  rating: number;
  title: string;
  body: string;
  status: ReviewStatusValue;
}

export const REVIEW_SORTS = ["recent", "highest", "lowest"] as const;
export type ReviewSort = (typeof REVIEW_SORTS)[number];

export const REVIEW_PAGE_SIZE = 10;

export interface ReviewPageQuery {
  page: number;
  pageSize: number;
  sort: ReviewSort;
  rating?: StarRating;
}
