import { z } from "zod";

const emptyToNull = (value: unknown) => (typeof value === "string" && value.trim() === "" ? null : value);

export const storyPageParamSchema = z.enum(["AboutUs"]);

export const storyPageBlockInputSchema = z.object({
  blockKey: z.string().trim().min(1),
  blockType: z.enum(["Hero", "Chapter", "IngredientItem", "ProductCategoryItem", "ValueItem", "GlobalJourney", "Cta"]),
  sortOrder: z.number().int().min(0),
  eyebrow: z.preprocess(emptyToNull, z.string().trim().min(1).nullable().optional()),
  title: z.preprocess(emptyToNull, z.string().trim().min(1).nullable().optional()),
  body: z.preprocess(emptyToNull, z.string().trim().min(1).max(4000).nullable().optional()),
  imageUrl: z.preprocess(emptyToNull, z.string().trim().min(1).nullable().optional()),
  imageAlt: z.preprocess(emptyToNull, z.string().trim().min(1).nullable().optional()),
  ctaLabel: z.preprocess(emptyToNull, z.string().trim().min(1).nullable().optional()),
  ctaHref: z.preprocess(emptyToNull, z.string().trim().min(1).nullable().optional()),
  secondaryCtaLabel: z.preprocess(emptyToNull, z.string().trim().min(1).nullable().optional()),
  secondaryCtaHref: z.preprocess(emptyToNull, z.string().trim().min(1).nullable().optional()),
  align: z.enum(["Left", "Center", "Right"]).nullable().optional(),
  letter: z.preprocess(emptyToNull, z.string().trim().min(1).max(2).nullable().optional()),
});

export const saveStoryPageBlocksSchema = z.object({
  blocks: z.array(storyPageBlockInputSchema),
});

export const contactPageCopySchema = z.object({
  contactHeroEyebrow: z.preprocess(emptyToNull, z.string().trim().min(1).nullable().optional()),
  contactHeroHeadline: z.preprocess(emptyToNull, z.string().trim().min(1).nullable().optional()),
  contactHeroSubcopy: z.preprocess(emptyToNull, z.string().trim().min(1).nullable().optional()),
  contactLocationHeading: z.preprocess(emptyToNull, z.string().trim().min(1).nullable().optional()),
});
