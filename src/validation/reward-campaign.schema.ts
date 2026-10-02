import { z } from "zod";

import { customerGroupEnum } from "@/validation/pricing.schema";

export const campaignSchema = z
  .object({
    name: z.string().trim().min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    targetCustomerGroup: customerGroupEnum.nullable().optional(),
    pointsMultiplier: z.number().positive(),
    isActive: z.boolean(),
  })
  .refine((data) => data.endDate > data.startDate, { message: "End date must be after the start date.", path: ["endDate"] });

export const campaignUpdateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    targetCustomerGroup: customerGroupEnum.nullable().optional(),
    pointsMultiplier: z.number().positive().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => !data.startDate || !data.endDate || data.endDate > data.startDate, { message: "End date must be after the start date.", path: ["endDate"] });
