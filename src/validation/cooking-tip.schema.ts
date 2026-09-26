import { z } from "zod";

export const cookingTipListQuerySchema = z.object({
  topic: z.string().trim().min(1).optional().catch(undefined),
  page: z.coerce.number().int().positive().catch(1),
  pageSize: z.coerce.number().int().positive().max(48).catch(12),
});
export type CookingTipListQuery = z.infer<typeof cookingTipListQuerySchema>;

export const cookingTipSlugParamSchema = z.object({
  slug: z.string().min(1),
});
