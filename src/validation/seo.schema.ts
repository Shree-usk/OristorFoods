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
});
