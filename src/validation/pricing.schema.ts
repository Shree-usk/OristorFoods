import { z } from "zod";

const customerGroupEnum = z.enum(["Retail", "Wholesale", "Distributor", "Export", "PrivateLabel"]);

export const standardPriceSchema = z.object({
  productId: z.string().min(1),
  price: z.number().nonnegative(),
  currency: z.string().default("LKR"),
});

export type StandardPriceInput = z.infer<typeof standardPriceSchema>;

const dateRangeSchema = z
  .object({
    startDate: z.date(),
    endDate: z.date(),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "endDate must be after startDate",
    path: ["endDate"],
  });

export const salePriceSchema = z
  .object({
    productId: z.string().min(1),
    price: z.number().nonnegative(),
    currency: z.string().default("LKR"),
  })
  .and(dateRangeSchema);

export type SalePriceInput = z.infer<typeof salePriceSchema>;

export const campaignPriceSchema = z
  .object({
    productId: z.string().min(1),
    campaignId: z.string().min(1),
    price: z.number().nonnegative(),
    currency: z.string().default("LKR"),
  })
  .and(dateRangeSchema);

export type CampaignPriceInput = z.infer<typeof campaignPriceSchema>;

export const customerGroupPriceSchema = z.object({
  productId: z.string().min(1),
  customerGroup: customerGroupEnum,
  price: z.number().nonnegative(),
  currency: z.string().default("LKR"),
});

export type CustomerGroupPriceInput = z.infer<typeof customerGroupPriceSchema>;

export const volumeDiscountTierSchema = z
  .object({
    productId: z.string().min(1),
    minQuantity: z.number().int().positive(),
    discountPrice: z.number().nonnegative().optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    currency: z.string().default("LKR"),
  })
  .refine(
    (data) => (data.discountPrice !== undefined) !== (data.discountPercent !== undefined),
    {
      message: "Exactly one of discountPrice or discountPercent is required",
      path: ["discountPrice"],
    },
  );

export type VolumeDiscountTierInput = z.infer<typeof volumeDiscountTierSchema>;

export const resolvePriceParamsSchema = z.object({
  productId: z.string().min(1),
  customerGroup: customerGroupEnum.optional(),
  quantity: z.number().int().positive().optional(),
  date: z.date().optional(),
});

export type ResolvePriceParamsInput = z.infer<typeof resolvePriceParamsSchema>;
