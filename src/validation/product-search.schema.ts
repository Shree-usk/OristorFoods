import { z } from "zod";

import { productListingQuerySchema, productSortValues } from "@/validation/product-listing.schema";

/**
 * Reuses productListingQuerySchema's exact filter/sort/pagination shape
 * (same `.catch()`-everywhere convention — a malformed request degrades
 * to a default, never a 400) minus category/collection (search doesn't
 * scope to either), plus the search query itself.
 *
 * `sort` is overridden (not inherited) to default to "relevance" instead
 * of the base schema's "newest" — the search page's sort default only
 * makes sense relative to a query, unlike plain category/collection
 * listing pages.
 */
export const productSearchQuerySchema = productListingQuerySchema
  .omit({ category: true, collection: true })
  .extend({
    q: z.string().trim().catch(""),
    sort: z.enum(productSortValues).catch("relevance"),
  });

export type ProductSearchQuery = z.infer<typeof productSearchQuerySchema>;
