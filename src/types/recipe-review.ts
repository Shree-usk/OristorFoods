/**
 * Recipe review types and constants shared by server and client code
 * (STORY-022). Keep this file free of server-only imports (Prisma,
 * services): client components import from it directly.
 */

/** A Approved review as returned by the public API and shown on the recipe detail page. */
export interface PublicRecipeReview {
  id: string;
  authorName: string;
  rating: number;
  reviewText: string | null;
  /** ISO 8601 string. */
  createdAt: string;
}

export interface RecipeReviewPage {
  items: PublicRecipeReview[];
  total: number;
  page: number;
  pageSize: number;
}

export type RecipeReviewStatusValue = "Pending" | "Approved" | "Rejected" | "Hidden";

/** The signed-in customer's own review, in any status. */
export interface OwnRecipeReview {
  id: string;
  rating: number;
  reviewText: string | null;
  status: RecipeReviewStatusValue;
}

export const RECIPE_REVIEW_SORTS = ["recent", "highest", "lowest"] as const;
export type RecipeReviewSort = (typeof RECIPE_REVIEW_SORTS)[number];

export const RECIPE_REVIEW_PAGE_SIZE = 10;

export interface RecipeReviewPageQuery {
  page: number;
  pageSize: number;
  sort: RecipeReviewSort;
}
