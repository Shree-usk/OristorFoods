import { z } from "zod";

/** STORY-050e. Validation for the admin Landing Page CRUD endpoints. */

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const contentAlignmentEnum = z.enum(["Left", "Center", "Right"]);
export const landingPageStatusEnum = z.enum(["Draft", "Published", "Archived"]);

export const landingPageSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1, "Slug is required.").regex(slugRegex, "Slug must be lowercase, alphanumeric, and hyphen-separated."),
  metaTitle: z.string().trim().min(1).nullable().optional(),
  metaDescription: z.string().trim().min(1).nullable().optional(),
});

export const landingPageUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  slug: z.string().trim().min(1, "Slug is required.").regex(slugRegex, "Slug must be lowercase, alphanumeric, and hyphen-separated.").optional(),
  metaTitle: z.string().trim().min(1).nullable().optional(),
  metaDescription: z.string().trim().min(1).nullable().optional(),
});

export const updateLandingPageStatusSchema = z.object({
  status: landingPageStatusEnum,
});

export const landingPageBlockSchema = z
  .object({
    headline: z.string().trim().min(1),
    subheadline: z.string().trim().min(1).nullable().optional(),
    supportingText: z.string().trim().min(1).nullable().optional(),
    ctaLabel: z.string().trim().min(1).nullable().optional(),
    ctaHref: z.string().trim().min(1).nullable().optional(),
    secondaryCtaLabel: z.string().trim().min(1).nullable().optional(),
    secondaryCtaHref: z.string().trim().min(1).nullable().optional(),
    desktopImageUrl: z.string().trim().min(1),
    desktopImageAlt: z.string().trim().min(1),
    mobileImageUrl: z.string().trim().min(1).nullable().optional(),
    mobileImageAlt: z.string().trim().min(1).nullable().optional(),
    videoUrl: z.string().trim().min(1).nullable().optional(),
    overlayEnabled: z.boolean().default(false),
    alignment: contentAlignmentEnum.default("Left"),
  })
  .refine((data) => !data.ctaLabel || data.ctaHref, { message: "A CTA link is required when a CTA label is set.", path: ["ctaHref"] })
  .refine((data) => !data.secondaryCtaLabel || data.secondaryCtaHref, { message: "A link is required when a secondary CTA label is set.", path: ["secondaryCtaHref"] });

export const landingPageBlockUpdateSchema = z.object({
  headline: z.string().trim().min(1).optional(),
  subheadline: z.string().trim().min(1).nullable().optional(),
  supportingText: z.string().trim().min(1).nullable().optional(),
  ctaLabel: z.string().trim().min(1).nullable().optional(),
  ctaHref: z.string().trim().min(1).nullable().optional(),
  secondaryCtaLabel: z.string().trim().min(1).nullable().optional(),
  secondaryCtaHref: z.string().trim().min(1).nullable().optional(),
  desktopImageUrl: z.string().trim().min(1).optional(),
  desktopImageAlt: z.string().trim().min(1).optional(),
  mobileImageUrl: z.string().trim().min(1).nullable().optional(),
  mobileImageAlt: z.string().trim().min(1).nullable().optional(),
  videoUrl: z.string().trim().min(1).nullable().optional(),
  overlayEnabled: z.boolean().optional(),
  alignment: contentAlignmentEnum.optional(),
  visible: z.boolean().optional(),
});

export const reorderBlocksSchema = z.object({
  blockIds: z.array(z.string().trim().min(1)).min(1),
});
