import { z } from "zod";

export const updateRewardSettingSchema = z.object({
  pointsToCurrencyRate: z.number().positive().nullable().optional(),
  maxRedeemablePointsPerOrder: z.number().int().positive().nullable().optional(),
  pointsExpiryDays: z.number().int().positive().nullable().optional(),
  orderValuePointsRate: z.number().positive().nullable().optional(),
});

export const tierSchema = z.object({
  name: z.string().trim().min(1),
  minLifetimePoints: z.number().int().min(0),
  sortOrder: z.number().int().min(0),
  isActive: z.boolean(),
});

export const tierUpdateSchema = tierSchema.partial();

const criteriaTypeEnum = z.enum(["first_order", "order_count", "lifetime_points"]);

export const badgeSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().min(1).nullable().optional(),
  criteriaType: criteriaTypeEnum,
  threshold: z.number().int().positive().nullable().optional(),
  isActive: z.boolean(),
});

export const badgeUpdateSchema = badgeSchema.partial();
