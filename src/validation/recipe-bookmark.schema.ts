import { z } from "zod";

/** Same 200-id cap `wishlist.schema.ts`'s mergeWishlistSchema applies, for the same reason: a small, bounded guest-store payload, not a listing endpoint. */
export const mergeRecipeBookmarksSchema = z.object({
  recipeIds: z.array(z.string().min(1)).max(200),
});

export type MergeRecipeBookmarksInput = z.infer<typeof mergeRecipeBookmarksSchema>;
