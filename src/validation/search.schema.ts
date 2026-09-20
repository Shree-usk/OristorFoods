import { z } from "zod";

/**
 * `.catch()` on every field (never `.min(1)`/a hard validation error) —
 * matches product-listing.schema.ts's convention: a malformed or missing
 * query degrades to an empty/default result (200) instead of breaking
 * the page for whoever followed a broken link.
 */
export const searchQuerySchema = z.object({
  q: z.string().trim().catch(""),
  page: z.coerce.number().int().positive().catch(1),
  pageSize: z.coerce.number().int().positive().max(60).optional().catch(undefined),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
