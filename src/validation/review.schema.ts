import { z } from "zod";

import { REVIEW_PAGE_SIZE, REVIEW_SORTS } from "@/types/review";

const RATING_MESSAGE = "Please choose a star rating";

/** Shared by ReviewForm (client) and the POST/PATCH review routes (server). */
export const reviewInputSchema = z.object({
  rating: z.number({ error: RATING_MESSAGE }).int(RATING_MESSAGE).min(1, RATING_MESSAGE).max(5, RATING_MESSAGE),
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(120, "Title must be 120 characters or fewer"),
  body: z
    .string()
    .trim()
    .min(20, "Review must be at least 20 characters")
    .max(2000, "Review must be 2,000 characters or fewer"),
});

export type ReviewInput = z.infer<typeof reviewInputSchema>;

export const reviewListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(REVIEW_PAGE_SIZE),
  sort: z.enum(REVIEW_SORTS).default("recent"),
  rating: z.coerce.number().int().min(1).max(5).optional(),
});

export type ReviewListQuery = z.infer<typeof reviewListQuerySchema>;
