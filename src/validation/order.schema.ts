import { z } from "zod";

/** Order payloads (STORY-028). */

export const cancelOrderSchema = z.object({
  reason: z.string().trim().max(500, "Reason must be 500 characters or fewer").optional(),
});

export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;

/**
 * A malformed page/pageSize (e.g. a stale bookmarked URL) falls back to
 * sane defaults rather than rejecting the request — same pattern as
 * product-listing.schema.ts.
 */
export const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().catch(1),
  pageSize: z.coerce.number().int().positive().max(50).catch(20),
});

export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
