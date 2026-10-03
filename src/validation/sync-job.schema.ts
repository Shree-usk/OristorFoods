import { z } from "zod";

export const triggerSyncSchema = z.object({
  jobType: z.string().trim().min(1, "Job type is required.").max(100),
  targetEntityType: z.string().trim().min(1).max(100).nullable().optional(),
  targetEntityId: z.string().trim().min(1).max(200).nullable().optional(),
  payload: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const syncJobFiltersSchema = z.object({
  jobType: z.string().trim().min(1).optional(),
  status: z.enum(["Queued", "Processing", "Success", "Failed"]).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  targetEntityId: z.string().trim().min(1).optional(),
});
