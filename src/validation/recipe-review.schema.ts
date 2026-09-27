import { z } from "zod";

import { RECIPE_REVIEW_PAGE_SIZE, RECIPE_REVIEW_SORTS } from "@/types/recipe-review";

const RATING_MESSAGE = "Please choose a star rating";

/**
 * Shared by RecipeReviewForm (client) and the POST/PATCH review routes
 * (server). `reviewText` transforms an empty string to `undefined`: React
 * Hook Form submits `""` for an untouched textarea, and without this
 * transform an empty review would fail to round-trip as `null` the way the
 * nullable `RecipeReview.reviewText` column expects (the same empty-string-
 * vs-undefined gotcha fixed in STORY-021's blog comment form).
 */
export const recipeReviewInputSchema = z.object({
  rating: z.number({ error: RATING_MESSAGE }).int(RATING_MESSAGE).min(1, RATING_MESSAGE).max(5, RATING_MESSAGE),
  reviewText: z
    .string()
    .trim()
    .max(2000, "Review must be 2,000 characters or fewer")
    .transform((value) => (value === "" ? undefined : value))
    .optional(),
});

export type RecipeReviewInput = z.infer<typeof recipeReviewInputSchema>;

export const recipeReviewListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(RECIPE_REVIEW_PAGE_SIZE),
  sort: z.enum(RECIPE_REVIEW_SORTS).default("recent"),
});

export type RecipeReviewListQuery = z.infer<typeof recipeReviewListQuerySchema>;
