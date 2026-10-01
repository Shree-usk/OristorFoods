import { z } from "zod";

import { customerGroupEnum } from "@/validation/pricing.schema";

export const setCustomerGroupSchema = z.object({
  customerGroup: customerGroupEnum,
});

const accountStatusEnum = z.enum(["Active", "DeactivationRequested", "Deactivated", "Suspended"]);

export const listCustomersAdminQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: accountStatusEnum.optional(),
  search: z.string().trim().min(1).optional(),
  registeredFrom: z.coerce.date().optional(),
  registeredTo: z.coerce.date().optional(),
});

export const suspendCustomerSchema = z.object({
  reason: z.string().trim().min(1, "A reason is required."),
});

export const grantRewardSchema = z.object({
  points: z.number().int().positive(),
  reason: z.string().trim().min(1, "A reason is required so it's recorded."),
  expiresAt: z.coerce.date().optional(),
});

const couponDiscountTypeEnum = z.enum(["PercentageOff", "FixedAmountOff", "FreeShipping"]);

export const issueCouponSchema = z
  .object({
    discountType: couponDiscountTypeEnum,
    percentOff: z.number().min(0).max(100).optional(),
    amountOff: z.number().positive().optional(),
    expiresInDays: z.number().int().positive(),
    usageLimit: z.number().int().positive(),
  })
  .refine((data) => data.discountType !== "PercentageOff" || data.percentOff !== undefined, { message: "percentOff is required for PercentageOff.", path: ["percentOff"] })
  .refine((data) => data.discountType !== "FixedAmountOff" || data.amountOff !== undefined, { message: "amountOff is required for FixedAmountOff.", path: ["amountOff"] });

export const addCustomerNoteSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});
