import { z } from "zod";

export const productSlugParamSchema = z.object({
  slug: z.string().min(1),
});

export const recentlyViewedItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  href: z.string(),
  imageSrc: z.string(),
  imageAlt: z.string(),
  price: z.number(),
  currency: z.string(),
  inStock: z.boolean(),
});

export type RecentlyViewedItem = z.infer<typeof recentlyViewedItemSchema>;
