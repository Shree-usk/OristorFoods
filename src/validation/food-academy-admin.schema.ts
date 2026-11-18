import { z } from "zod";

// Separate from food-academy.schema.ts, which only validates the public
// read-side query params (list filters, slug param) — these validate the
// new admin write paths.

const slugSchema = z.string().trim().min(1).max(150).regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens only.");

/**
 * Every optional admin-form field (descriptions, CTA labels/hrefs, image
 * URLs/alt text) — the form always submits the key with a value, never
 * omits it, so an untouched field arrives as `""`, not `undefined`. Without
 * this, a plain `.min(1)` on an image URL would reject a left-blank field
 * outright, and a plain `.optional().nullable()` with no `.min(1)` would
 * instead persist a stray `""` that the storefront's `?? default` merge
 * can't distinguish from "really set to an empty string". Normalizing `""`
 * (and `undefined`) to `null` here means every downstream consumer only
 * ever sees "has a real value" or `null`, never a fake empty string.
 */
function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));
}

export const foodAcademyCategoryAdminSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: slugSchema,
  description: optionalText(500),
  tileImageUrl: optionalText(500),
  tileImageAlt: optionalText(200),
  status: z.enum(["Active", "Inactive"]).optional(),
});

export type FoodAcademyCategoryAdminInput = z.infer<typeof foodAcademyCategoryAdminSchema>;

const foodAcademySectionAdminSchema = z.object({
  sectionNumber: z.coerce.number().int().positive(),
  title: z.string().trim().min(1).max(150),
  bodyContent: z.string().trim().min(1),
  imageUrl: optionalText(500),
});

export const foodAcademyEntryAdminSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(500),
  heroImageUrl: optionalText(500),
  contentType: z.enum(["Article", "Guide", "Course"]),
  categoryId: z.string().min(1),
  bodyContent: z.string().trim().optional().nullable(),
  readingTimeMinutes: z.coerce.number().int().positive().optional().nullable(),
  authorName: optionalText(100),
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
  heroEyebrow: optionalText(80),
  heroHeading: optionalText(150),
  heroDescription: optionalText(500),
  heroPrimaryCtaLabel: optionalText(60),
  heroPrimaryCtaHref: optionalText(300),
  heroSecondaryCtaLabel: optionalText(60),
  heroSecondaryCtaHref: optionalText(300),
  heroImageUrl: optionalText(500),
  heroImageAlt: optionalText(200),
  heroBadgeText: optionalText(100),
  exploreHeading: optionalText(150),
  exploreDescription: optionalText(400),
  featuredHeading: optionalText(150),
  featuredDescription: optionalText(400),
  instagramEnabled: z.boolean().optional(),
  instagramHeading: optionalText(150),
  instagramDescription: optionalText(400),
  instagramCtaLabel: optionalText(60),
  instagramCtaHref: optionalText(300),
  seoTitle: optionalText(150),
  seoMetaDescription: optionalText(300),
  seoCanonicalPath: optionalText(200),
  seoOgImageUrl: optionalText(500),
});

export type FoodAcademyPageSettingAdminInput = z.infer<typeof foodAcademyPageSettingAdminSchema>;
