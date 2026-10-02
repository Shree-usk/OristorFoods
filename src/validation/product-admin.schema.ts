import { z } from "zod";

import { customerGroupPriceSchema, standardPriceSchema } from "@/validation/pricing.schema";

const productTypeEnum = z.enum(["Standard", "Bundle", "GiftPack", "Seasonal", "LimitedEdition"]);
const mediaRoleEnum = z.enum(["Gallery", "Lifestyle", "Video"]);
const productStatusEnum = z.enum(["Draft", "Published", "Archived"]);
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const imageSchema = z.object({
  url: z.string().trim().min(1, "Image URL is required.").url("Enter a valid URL."),
  altText: z.string().trim().max(200).optional(),
  isPrimary: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  mediaRole: mediaRoleEnum.optional(),
});

const videoSchema = z.object({
  url: z.string().trim().min(1, "Video URL is required.").url("Enter a valid URL."),
  altText: z.string().trim().max(200).optional(),
  isPrimary: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const nutritionSchema = z.object({
  servingSize: z.string().trim().min(1, "Serving size is required."),
  calories: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  saturatedFat: z.number().nonnegative(),
  carbohydrates: z.number().nonnegative(),
  sugar: z.number().nonnegative(),
  fibre: z.number().nonnegative(),
  sodium: z.number().nonnegative(),
});

const ingredientSchema = z.object({
  name: z.string().trim().min(1, "Ingredient name is required."),
  isAllergen: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

/** Create and update share one shape — every field group editable at once (AC). */
export const productAdminSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(200),
  slug: z.string().trim().min(1, "Slug is required.").regex(slugRegex, "Slug must be lowercase, alphanumeric, and hyphen-separated."),
  sku: z.string().trim().min(1, "SKU is required.").max(64),
  barcode: z.string().trim().max(64).optional().nullable(),
  shortDescription: z.string().trim().max(500).optional().nullable(),
  story: z.string().trim().max(5000).optional().nullable(),
  productType: productTypeEnum.optional(),
  brandId: z.string().trim().min(1).optional().nullable(),
  categoryIds: z.array(z.string().min(1)).min(1, "Select at least one category."),
  collectionIds: z.array(z.string().min(1)).optional(),
  benefits: z.array(z.string().trim().min(1)).optional(),
  servingSuggestions: z.array(z.string().trim().min(1)).optional(),
  rewardPoints: z.number().int().min(0).optional(),
  inStock: z.boolean().optional(),
  stockQuantity: z.number().int().min(0).optional(),
  weightGrams: z.number().int().positive().optional().nullable(),
  images: z.array(imageSchema),
  videos: z.array(videoSchema).optional(),
  nutrition: nutritionSchema,
  ingredients: z.array(ingredientSchema).optional(),
  allergenIds: z.array(z.string().min(1)).optional(),
  certificationIds: z.array(z.string().min(1)).optional(),
});

export type ProductAdminFormInput = z.infer<typeof productAdminSchema>;

export const duplicateProductSchema = z.object({
  newSlug: z.string().trim().min(1, "Slug is required.").regex(slugRegex, "Slug must be lowercase, alphanumeric, and hyphen-separated."),
  newSku: z.string().trim().min(1, "SKU is required.").max(64),
});

export const changeStatusSchema = z.object({ status: productStatusEnum });

export const bulkStatusChangeSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Select at least one product."),
  status: productStatusEnum,
});

export const bulkDeleteSchema = z.object({ ids: z.array(z.string().min(1)).min(1, "Select at least one product.") });

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(["Draft", "Published", "Archived", "Discontinued", "OutOfSeason", "Review"]).optional(),
  categoryId: z.string().min(1).optional(),
  stockLevel: z.enum(["in_stock", "low_stock", "out_of_stock"]).optional(),
  search: z.string().trim().min(1).optional(),
});

// --- Pricing sub-forms ---
// standardPriceSchema/customerGroupPriceSchema (pricing.schema.ts, STORY-009)
// are reused directly, minus `productId` (the route's [id] param, not the
// body). salePriceSchema/campaignPriceSchema there compose a date-range
// `.refine()` via `.and()`, which produces a ZodIntersection with no
// `.omit()` — simpler to restate their (small) shape here than fight that
// composition.
export const setStandardPriceSchema = standardPriceSchema.omit({ productId: true });
export const setCustomerGroupPriceSchema = customerGroupPriceSchema.omit({ productId: true });

const dateRangeRefinement = <T extends { startDate: Date; endDate: Date }>(data: T) => data.endDate > data.startDate;

export const upsertSalePriceSchema = z
  .object({
    id: z.string().min(1).optional(),
    price: z.number().nonnegative(),
    currency: z.string().default("LKR"),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .refine(dateRangeRefinement, { message: "endDate must be after startDate", path: ["endDate"] });

export const upsertCampaignPriceSchema = z
  .object({
    id: z.string().min(1).optional(),
    campaignId: z.string().trim().min(1, "Campaign is required."),
    price: z.number().nonnegative(),
    currency: z.string().default("LKR"),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .refine(dateRangeRefinement, { message: "endDate must be after startDate", path: ["endDate"] });

export const upsertVolumeDiscountTierSchema = z
  .object({
    id: z.string().min(1).optional(),
    minQuantity: z.number().int().positive(),
    discountPrice: z.number().nonnegative().optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    currency: z.string().default("LKR"),
  })
  .refine((data) => (data.discountPrice !== undefined) !== (data.discountPercent !== undefined), {
    message: "Exactly one of discountPrice or discountPercent is required",
    path: ["discountPrice"],
  });
