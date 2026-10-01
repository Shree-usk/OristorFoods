import { z } from "zod";

import { RECIPE_QUESTION_PAGE_SIZE } from "@/types/recipe-question";
import { answerTextSchema } from "@/validation/question.schema";

/** Mirrors questionInputSchema (STORY-016) — same bounds, different content type. */
export const recipeQuestionInputSchema = z.object({
  text: z
    .string()
    .trim()
    .min(10, "Question must be at least 10 characters")
    .max(500, "Question must be 500 characters or fewer"),
});

export type RecipeQuestionInput = z.infer<typeof recipeQuestionInputSchema>;

/** Reused as-is from question.schema.ts — not Product-specific, no need to clone. */
export { answerTextSchema };

export const recipeQuestionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(RECIPE_QUESTION_PAGE_SIZE),
});

export type RecipeQuestionListQuery = z.infer<typeof recipeQuestionListQuerySchema>;
