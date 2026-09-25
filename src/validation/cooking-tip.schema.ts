import { z } from "zod";

/**
 * Query contract for /cooking-tips and GET /api/cooking-tips. Every field
 * uses `.catch()`, so a malformed or stale query never fails the request. It
 * falls back to defaults instead (same policy as recipeListingQuerySchema).
 */
export const cookingTipListQuerySchema = z.object({
  topic: z.string().trim().min(1).optional().catch(undefined),
  page: z.coerce.number().int().positive().catch(1),
  pageSize: z.coerce.number().int().positive().max(48).catch(12),
});

export type CookingTipListingQuery = z.infer<typeof cookingTipListQuerySchema>;

/**
 * Route params for /cooking-tips/[slug].
 */
export const cookingTipSlugParamSchema = z.object({
  slug: z.string().min(1),
});

export type CookingTipSlugParam = z.infer<typeof cookingTipSlugParamSchema>;
