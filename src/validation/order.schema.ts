import { z } from "zod";

/** Order payloads (STORY-028). */

export const cancelOrderSchema = z.object({
  reason: z.string().trim().max(500, "Reason must be 500 characters or fewer").optional(),
});

export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;

// STORY-036. The real OrderStatus enum — not the story doc's own stale
// Pending/Processing/Dispatched/Delivered/Returned/Cancelled wording. See
// docs/architecture-decisions.md.
export const orderStatusFilterSchema = z.enum(["PendingConfirmation", "Confirmed", "Processing", "Dispatched", "Delivered", "Cancelled", "Returned"]);

/**
 * A malformed page/pageSize (e.g. a stale bookmarked URL) falls back to
 * sane defaults rather than rejecting the request — same pattern as
 * product-listing.schema.ts. STORY-036: status/dateFrom/dateTo are all
 * optional filters, silently ignored (`.catch(undefined)`) if malformed
 * rather than rejecting the whole list request.
 */
export const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().catch(1),
  pageSize: z.coerce.number().int().positive().max(50).catch(20),
  status: orderStatusFilterSchema.optional().catch(undefined),
  dateFrom: z.coerce.date().optional().catch(undefined),
  dateTo: z.coerce.date().optional().catch(undefined),
});

export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
