import { z } from "zod";

import { productListingQuerySchema } from "@/validation/product-listing.schema";

/**
 * Reuses productListingQuerySchema's exact filter/sort/pagination shape
 * (same `.catch()`-everywhere convention — a malformed request degrades
 * to a default, never a 400) minus category/collection (search doesn't
 * scope to either), plus the search query itself.
 */
export const productSearchQuerySchema = productListingQuerySchema
  .omit({ category: true, collection: true })
  .extend({
    q: z.string().trim().catch(""),
  });

export type ProductSearchQuery = z.infer<typeof productSearchQuerySchema>;
