import { z } from "zod";

/** STORY-064. Admin API filters for churn-risk listing. */

export const listChurnScoresQuerySchema = z.object({
  riskTier: z.enum(["Low", "Medium", "High"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export type ListChurnScoresQuery = z.infer<typeof listChurnScoresQuerySchema>;

export const exportChurnTierSchema = z.object({
  riskTier: z.enum(["Low", "Medium", "High"]),
});
