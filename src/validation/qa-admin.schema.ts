import { z } from "zod";

import { answerTextSchema } from "@/validation/question.schema";

export { answerTextSchema };

export const listQuestionsAdminQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(["Pending", "Answered", "Approved", "Published", "Rejected"]).optional(),
  productId: z.string().trim().min(1).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  search: z.string().trim().min(1).optional(),
});

export const answerQuestionSchema = z.object({
  answerText: answerTextSchema,
});

export const rejectQuestionSchema = z.object({
  reason: z.string().trim().min(1, "A reason is required so it's recorded internally."),
});

export const bulkQaModerationSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1, "Select at least one question."),
  action: z.enum(["approve", "publish"]),
});
