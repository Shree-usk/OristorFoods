import { z } from "zod";

export const addWishlistItemSchema = z.object({
  productId: z.string().min(1),
});

export const mergeWishlistSchema = z.object({
  productIds: z.array(z.string().min(1)).max(200),
});

export type AddWishlistItemInput = z.infer<typeof addWishlistItemSchema>;
export type MergeWishlistInput = z.infer<typeof mergeWishlistSchema>;
