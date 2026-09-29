import { z } from "zod";

/** Reward points redemption (STORY-030). */

export const redeemPointsSchema = z.object({
  points: z
    .number({ error: "Points are required" })
    .int("Points must be a whole number")
    .positive("Enter a positive number of points"),
});

export type RedeemPointsInput = z.infer<typeof redeemPointsSchema>;

/**
 * A malformed page/pageSize (e.g. a stale bookmarked URL) falls back to
 * sane defaults rather than rejecting the request — same pattern as
 * order.schema.ts::listOrdersQuerySchema.
 */
export const listRewardTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().catch(1),
  pageSize: z.coerce.number().int().positive().max(50).catch(20),
});

export type ListRewardTransactionsQuery = z.infer<typeof listRewardTransactionsQuerySchema>;
