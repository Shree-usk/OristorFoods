import { z } from "zod";

import { QUESTION_PAGE_SIZE } from "@/types/question";

/** Shared by AskQuestionForm (client) and POST /questions (server). */
export const questionInputSchema = z.object({
  text: z
    .string()
    .trim()
    .min(10, "Question must be at least 10 characters")
    .max(500, "Question must be 500 characters or fewer"),
});

export type QuestionInput = z.infer<typeof questionInputSchema>;

/** The staff answer (STORY-046, and the dev publish path). */
export const answerTextSchema = z
  .string()
  .trim()
  .min(1, "Answer can't be empty")
  .max(2000, "Answer must be 2,000 characters or fewer");

export const questionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(QUESTION_PAGE_SIZE),
  q: z
    .string()
    .trim()
    .max(100, "Search must be 100 characters or fewer")
    .optional()
    .transform((value) => value || undefined),
});

export type QuestionListQuery = z.infer<typeof questionListQuerySchema>;
