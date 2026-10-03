import { z } from "zod";

export const seoEntityTypeEnum = z.enum(["Product", "Recipe", "BlogPost"]);

export const seoMetaSchema = z.object({
  metaTitle: z.string().trim().min(1).nullable().optional(),
  metaDescription: z.string().trim().min(1).nullable().optional(),
  canonicalUrl: z.string().trim().url("Enter a valid URL.").or(z.literal("")).nullable().optional(),
  ogImageUrl: z.string().trim().min(1).nullable().optional(),
  ogImageAlt: z.string().trim().min(1).nullable().optional(),
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
