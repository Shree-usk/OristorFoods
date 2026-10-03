import { z } from "zod";

import { ADMIN_MODULES } from "@/validation/role-admin.schema";

export const auditLogFiltersSchema = z.object({
  actorId: z.string().trim().min(1).optional(),
  module: z.enum(ADMIN_MODULES).optional(),
  action: z.string().trim().min(1).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  targetId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().optional(),
});
