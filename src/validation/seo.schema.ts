import { z } from "zod";

export const seoEntityTypeEnum = z.enum(["Product", "Recipe", "BlogPost"]);

export const seoMetaSchema = z.object({
  metaTitle: z.string().trim().min(1).nullable().optional(),
  metaDescription: z.string().trim().min(1).nullable().optional(),
  canonicalUrl: z.string().trim().url("Enter a valid URL.").or(z.literal("")).nullable().optional(),
  ogImageUrl: z.string().trim().min(1).nullable().optional(),
  ogImageAlt: z.string().trim().min(1).nullable().optional(),
  ogImageWidth: z.number().int().positive().nullable().optional(),
  ogImageHeight: z.number().int().positive().nullable().optional(),
  robotsIndex: z.boolean().optional(),
  robotsFollow: z.boolean().optional(),
  focusKeyword: z.string().trim().min(1).nullable().optional(),
  // Raw structured data (schema.org JSON-LD), a full override of the
  // storefront's own auto-generated template for this page when set — not
  // schema.org-validated, just required to be real JSON (the admin panel
  // parses the textarea client-side before sending, so this is already a
  // parsed value by the time it reaches here, never a raw string).
  jsonLdOverride: z.unknown().nullable().optional(),
});

/** STORY-051d. The central list's bulk title-template apply — refs come from the client's own already-fetched list, not re-derived server-side. */
export const bulkApplyTitleTemplateSchema = z.object({
  refs: z
    .array(
      z.object({
        entityType: seoEntityTypeEnum,
        entityId: z.string().min(1),
        title: z.string().min(1),
      }),
    )
    .min(1),
  template: z.string().trim().min(1).refine((value) => value.includes("{title}"), "Template must include a {title} placeholder."),
});
