import { z } from "zod";

export const homepageSectionTypeEnum = z.enum([
  "HeroBanner",
  "FeaturedCategories",
  "WhyChooseOristor",
  "BestSellingProducts",
  "FeaturedRecipes",
  "ProductCollections",
  "FoodAcademy",
  "CustomerReviews",
  "ExportSolutions",
  "RewardsClub",
  "InstagramGallery",
]);

const contentAlignmentEnum = z.enum(["Left", "Center", "Right"]);

export const createDraftLayoutSchema = z.object({
  cloneFromPublished: z.boolean().default(false),
});

export const addSectionSchema = z.object({
  type: homepageSectionTypeEnum,
});

export const updateSectionSchema = z.object({
  visible: z.boolean().optional(),
  titleOverride: z.string().trim().max(200).optional().nullable(),
  descriptionOverride: z.string().trim().max(500).optional().nullable(),
});

export const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

/** ctaLabel/ctaHref and secondaryCtaLabel/secondaryCtaHref must each be present as a pair or absent as a pair — a label with no destination (or vice versa) is a broken CTA, not a valid partial state. */
export const heroBannerSlideSchema = z
  .object({
    headline: z.string().trim().min(1, "Headline is required.").max(200),
    subheadline: z.string().trim().max(300).optional().nullable(),
    supportingText: z.string().trim().max(500).optional().nullable(),
    ctaLabel: z.string().trim().max(60).optional().nullable(),
    ctaHref: z.string().trim().max(2000).optional().nullable(),
    secondaryCtaLabel: z.string().trim().max(60).optional().nullable(),
    secondaryCtaHref: z.string().trim().max(2000).optional().nullable(),
    desktopImageUrl: z.string().trim().min(1, "Desktop image is required."),
    desktopImageAlt: z.string().trim().min(1, "Desktop image alt text is required."),
    mobileImageUrl: z.string().trim().optional().nullable(),
    mobileImageAlt: z.string().trim().optional().nullable(),
    videoUrl: z.string().trim().optional().nullable(),
    overlayEnabled: z.boolean().default(false),
    alignment: contentAlignmentEnum.default("Left"),
    visible: z.boolean().default(true),
  })
  .refine((data) => Boolean(data.ctaLabel) === Boolean(data.ctaHref), {
    message: "CTA label and destination must be provided together.",
    path: ["ctaHref"],
  })
  .refine((data) => Boolean(data.secondaryCtaLabel) === Boolean(data.secondaryCtaHref), {
    message: "Secondary CTA label and destination must be provided together.",
    path: ["secondaryCtaHref"],
  })
  .refine((data) => Boolean(data.mobileImageUrl) === Boolean(data.mobileImageAlt), {
    message: "Mobile image and its alt text must be provided together.",
    path: ["mobileImageAlt"],
  });

export const updateHeroBannerSlideSchema = z
  .object({
    headline: z.string().trim().min(1, "Headline is required.").max(200).optional(),
    subheadline: z.string().trim().max(300).optional().nullable(),
    supportingText: z.string().trim().max(500).optional().nullable(),
    ctaLabel: z.string().trim().max(60).optional().nullable(),
    ctaHref: z.string().trim().max(2000).optional().nullable(),
    secondaryCtaLabel: z.string().trim().max(60).optional().nullable(),
    secondaryCtaHref: z.string().trim().max(2000).optional().nullable(),
    desktopImageUrl: z.string().trim().min(1).optional(),
    desktopImageAlt: z.string().trim().min(1).optional(),
    mobileImageUrl: z.string().trim().optional().nullable(),
    mobileImageAlt: z.string().trim().optional().nullable(),
    videoUrl: z.string().trim().optional().nullable(),
    overlayEnabled: z.boolean().optional(),
    alignment: contentAlignmentEnum.optional(),
    visible: z.boolean().optional(),
  })
  .refine((data) => Boolean(data.ctaLabel) === Boolean(data.ctaHref) || data.ctaLabel === undefined || data.ctaHref === undefined, {
    message: "CTA label and destination must be provided together.",
    path: ["ctaHref"],
  });

export const listLayoutsQuerySchema = z.object({
  status: z.enum(["Draft", "Published", "Archived"]).optional(),
});
