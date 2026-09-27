import { z } from "zod";

export const downloadListQuerySchema = z.object({
  category: z.string().trim().min(1).optional().catch(undefined),
  page: z.coerce.number().int().positive().catch(1),
  pageSize: z.coerce.number().int().positive().max(48).catch(24),
});

export type DownloadListQuery = z.infer<typeof downloadListQuerySchema>;
