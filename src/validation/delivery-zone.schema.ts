import { z } from "zod";

import { deliveryRateTiersSchema } from "@/validation/shipping.schema";

export const deliveryZoneInputSchema = z.object({
  name: z.string().trim().min(1, "Zone name is required.").max(100),
  cities: z.array(z.string().trim().min(1)).min(1, "At least one city is required."),
  isActive: z.boolean().default(true),
});

export const deliveryRateInputSchema = z
  .object({
    rateType: z.enum(["Flat", "WeightBased", "ValueBased"]),
    flatAmount: z.number().nonnegative().optional(),
    tiers: deliveryRateTiersSchema.optional(),
    estimatedDaysMin: z.number().int().positive().optional().nullable(),
    estimatedDaysMax: z.number().int().positive().optional().nullable(),
  })
  .refine((data) => (data.rateType === "Flat" ? data.flatAmount !== undefined : data.tiers !== undefined), {
    message: "Flat rates require flatAmount; WeightBased/ValueBased rates require tiers.",
    path: ["flatAmount"],
  })
  .refine(
    (data) =>
      data.estimatedDaysMin === undefined ||
      data.estimatedDaysMin === null ||
      data.estimatedDaysMax === undefined ||
      data.estimatedDaysMax === null ||
      data.estimatedDaysMax >= data.estimatedDaysMin,
    { message: "estimatedDaysMax must be at or after estimatedDaysMin.", path: ["estimatedDaysMax"] },
  );

export const deliveryOverrideInputSchema = z
  .object({
    campaignName: z.string().trim().min(1, "Campaign name is required.").max(150),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    freeShipping: z.boolean().optional(),
    overrideAmount: z.number().nonnegative().optional(),
  })
  .refine((data) => data.endsAt > data.startsAt, { message: "endsAt must be after startsAt.", path: ["endsAt"] })
  .refine((data) => (data.freeShipping === true) !== (data.overrideAmount !== undefined), {
    message: "Specify exactly one of freeShipping or overrideAmount.",
    path: ["overrideAmount"],
  });

export const updateDeliveryOverrideInputSchema = z
  .object({
    campaignName: z.string().trim().min(1).max(150).optional(),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().optional(),
    freeShipping: z.boolean().optional(),
    overrideAmount: z.number().nonnegative().optional(),
  })
  .refine(
    (data) => data.startsAt === undefined || data.endsAt === undefined || data.endsAt > data.startsAt,
    { message: "endsAt must be after startsAt.", path: ["endsAt"] },
  );
