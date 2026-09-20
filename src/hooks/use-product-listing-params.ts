"use client";

import { useQueryStates } from "nuqs";
import { parseAsStringLiteral } from "nuqs/server";

import { productListingParsers, productSortValues } from "@/lib/product-listing-params";

/**
 * `defaultSort` lets a caller override just the `sort` param's default
 * without touching `productListingParsers` itself — the plain `/products`
 * listing page (category/collection browsing) must keep defaulting to
 * "newest", while the search page (STORY-012) defaults to "relevance".
 */
export function useProductListingParams(
  defaultSort: (typeof productSortValues)[number] = "newest",
) {
  return useQueryStates({
    ...productListingParsers,
    sort: parseAsStringLiteral(productSortValues).withDefault(defaultSort),
  });
}
