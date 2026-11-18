import { z } from "zod";

// Separate from food-academy.schema.ts, which only validates the public
// read-side query params (list filters, slug param) — these validate the
// new admin write paths.

const slugSchema = z.string().trim().min(1).max(150).regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens only.");

export const foodAcademyCategoryAdminSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: slugSchema,
  description: z.string().trim().max(500).optional().nullable(),
  tileImageUrl: z.string().trim().min(1).max(500).optional().nullable(),
  tileImageAlt: z.string().trim().max(200).optional().nullable(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

export type FoodAcademyCategoryAdminInput = z.infer<typeof foodAcademyCategoryAdminSchema>;

const foodAcademySectionAdminSchema = z.object({
  sectionNumber: z.coerce.number().int().positive(),
  title: z.string().trim().min(1).max(150),
  bodyContent: z.string().trim().min(1),
  imageUrl: z.string().trim().min(1).max(500).optional().nullable(),
});

export const foodAcademyEntryAdminSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(500),
  heroImageUrl: z.string().trim().min(1).max(500).optional().nullable(),
  contentType: z.enum(["Article", "Guide", "Course"]),
  categoryId: z.string().min(1),
  bodyContent: z.string().trim().optional().nullable(),
  readingTimeMinutes: z.coerce.number().int().positive().optional().nullable(),
  authorName: z.string().trim().max(100).optional().nullable(),
  isFeatured: z.boolean().optional().default(false),
  sections: z.array(foodAcademySectionAdminSchema).max(20).optional().default([]),
  recipeIds: z.array(z.string().min(1)).max(20).optional().default([]),
  productIds: z.array(z.string().min(1)).max(20).optional().default([]),
});

export type FoodAcademyEntryAdminInput = z.infer<typeof foodAcademyEntryAdminSchema>;

export const foodAcademyReorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

export const foodAcademyPageSettingAdminSchema = z.object({
  enabled: z.boolean().optional(),
  heroEyebrow: z.string().trim().max(80).optional().nullable(),
  heroHeading: z.string().trim().max(150).optional().nullable(),
  heroDescription: z.string().trim().max(500).optional().nullable(),
  heroPrimaryCtaLabel: z.string().trim().max(60).optional().nullable(),
  heroPrimaryCtaHref: z.string().trim().max(300).optional().nullable(),
  heroSecondaryCtaLabel: z.string().trim().max(60).optional().nullable(),
  heroSecondaryCtaHref: z.string().trim().max(300).optional().nullable(),
  heroImageUrl: z.string().trim().min(1).max(500).optional().nullable(),
  heroImageAlt: z.string().trim().max(200).optional().nullable(),
  heroBadgeText: z.string().trim().max(100).optional().nullable(),
  exploreHeading: z.string().trim().max(150).optional().nullable(),
  exploreDescription: z.string().trim().max(400).optional().nullable(),
  featuredHeading: z.string().trim().max(150).optional().nullable(),
  featuredDescription: z.string().trim().max(400).optional().nullable(),
  instagramEnabled: z.boolean().optional(),
  instagramHeading: z.string().trim().max(150).optional().nullable(),
  instagramDescription: z.string().trim().max(400).optional().nullable(),
  instagramCtaLabel: z.string().trim().max(60).optional().nullable(),
  instagramCtaHref: z.string().trim().max(300).optional().nullable(),
  seoTitle: z.string().trim().max(150).optional().nullable(),
  seoMetaDescription: z.string().trim().max(300).optional().nullable(),
  seoCanonicalPath: z.string().trim().max(200).optional().nullable(),
  seoOgImageUrl: z.string().trim().min(1).max(500).optional().nullable(),
});

export type FoodAcademyPageSettingAdminInput = z.infer<typeof foodAcademyPageSettingAdminSchema>;
