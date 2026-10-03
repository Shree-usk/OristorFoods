import { z } from "zod";

/**
 * STORY-059b. Shared date-range + bucket query params for every
 * /api/admin/analytics/* route. `to` is bumped to the end of that
 * calendar day (23:59:59.999) after validation — a bare date like
 * "2026-10-04" otherwise parses to midnight, which would silently
 * exclude every order/user/cart created later that same day from a
 * report whose "To" field a human reads as "through today."
 */
export const analyticsQuerySchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
    bucket: z.enum(["day", "week", "month"]).default("day"),
    limit: z.coerce.number().int().positive().max(50).default(10),
    format: z.enum(["csv", "pdf"]).optional(),
    // Only used by the products-recipes report, to pick which of its two tables an export covers.
    metric: z.enum(["products", "recipes"]).default("products"),
  })
  .refine((data) => data.from <= data.to, { message: "'from' must be on or before 'to'.", path: ["from"] })
  .transform((data) => {
    const to = new Date(data.to);
    to.setUTCHours(23, 59, 59, 999);
    return { ...data, to };
  });

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
