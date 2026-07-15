import { z } from "zod";

const nutritionSchema = z.object({
  servingSize: z.string().min(1),
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
  name: z.string().min(1),
  isAllergen: z.boolean().default(false),
  sortOrder: z.number().int().nonnegative().default(0),
});

const imageSchema = z.object({
  url: z.string().min(1),
  altText: z.string().optional(),
  isPrimary: z.boolean().default(false),
  mediaRole: z.enum(["Gallery", "Lifestyle", "Video"]).default("Gallery"),
  sortOrder: z.number().int().nonnegative().default(0),
});

export const productCreateSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  barcode: z.string().optional(),
  slug: z.string().min(1, "Slug is required"),
  name: z.string().min(1, "Name is required"),
  shortDescription: z.string().optional(),
  story: z.string().optional(),
  status: z.enum(["Draft", "Review", "Published", "Archived", "Discontinued", "OutOfSeason"]),
  productType: z.enum(["Standard", "Bundle", "GiftPack", "Seasonal", "LimitedEdition"]),
  brandId: z.string().optional(),
  categoryIds: z.array(z.string()).default([]),
  collectionIds: z.array(z.string()).default([]),
  rewardPoints: z.number().int().nonnegative().default(0),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  canonicalUrl: z.string().optional(),
  ogImage: z.string().optional(),
  nutrition: nutritionSchema.optional(),
  ingredients: z.array(ingredientSchema).default([]),
  allergenIds: z.array(z.string()).default([]),
  certificationIds: z.array(z.string()).default([]),
  images: z.array(imageSchema).default([]),
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;

export const productUpdateSchema = productCreateSchema.partial().extend({
  id: z.string().min(1),
});

export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
