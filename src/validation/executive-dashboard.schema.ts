import { z } from "zod";

/**
 * STORY-059c. `to` is bumped to end-of-day after validation — the
 * same lesson 059b's analyticsQuerySchema already documents and
 * fixes (a bare date like "2026-10-04" otherwise parses to midnight,
 * silently excluding anything created later that same day).
 */
export const executiveSummaryQuerySchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .refine((data) => data.from <= data.to, { message: "'from' must be on or before 'to'.", path: ["from"] })
  .transform((data) => {
    const to = new Date(data.to);
    to.setUTCHours(23, 59, 59, 999);
    return { ...data, to };
  });

export type ExecutiveSummaryQuery = z.infer<typeof executiveSummaryQuerySchema>;

const REPORT_TYPES = ["sales", "customers", "products-recipes", "funnel", "executive-summary"] as const;

export const scheduledReportSchema = z.object({
  reportType: z.enum(REPORT_TYPES),
  recipients: z.array(z.string().trim().email()).min(1, "At least one recipient is required."),
  frequency: z.enum(["Weekly", "Monthly"]),
});

export const updateScheduledReportSchema = scheduledReportSchema.partial();

export type ScheduledReportFormInput = z.infer<typeof scheduledReportSchema>;
export type UpdateScheduledReportFormInput = z.infer<typeof updateScheduledReportSchema>;
