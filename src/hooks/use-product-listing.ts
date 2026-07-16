"use client";

import { useQuery } from "@tanstack/react-query";
import type { Values } from "nuqs";

import { productListingParsers } from "@/lib/product-listing-params";
import type { ProductListingResult } from "@/services/product.service";

export interface ProductListingScope {
  category?: string;
  collection?: string;
}

export type ProductListingQueryParams = Values<typeof productListingParsers>;

function buildSearchParams(
  scope: ProductListingScope,
  params: ProductListingQueryParams,
  pageSize: number,
): string {
  const search = new URLSearchParams();
  if (scope.category) search.set("category", scope.category);
  if (scope.collection) search.set("collection", scope.collection);
  search.set("page", String(params.page));
  search.set("sort", params.sort);
  search.set("pageSize", String(pageSize));
  if (params.priceMin !== null) search.set("priceMin", String(params.priceMin));
  if (params.priceMax !== null) search.set("priceMax", String(params.priceMax));
  if (params.allergens && params.allergens.length > 0) search.set("allergens", params.allergens.join(","));
  if (params.certifications && params.certifications.length > 0)
    search.set("certifications", params.certifications.join(","));
  if (params.brands && params.brands.length > 0) search.set("brands", params.brands.join(","));
  if (params.inStock !== null) search.set("inStock", String(params.inStock));
  return search.toString();
}

export function useProductListing(
  scope: ProductListingScope,
  params: ProductListingQueryParams,
  initialData: ProductListingResult,
) {
  // The page size for this page instance is fixed at whatever the initial
  // server-rendered load used (normally 24, the client default — see
  // Global Constraints in the plan this was built from) — every subsequent
  // client-driven refetch (filter/sort/page changes) keeps using that same
  // value, rather than a hardcoded constant that would silently override
  // an explicit ?pageSize= query override on the very first background
  // refetch after hydration.
  const pageSize = initialData.pageSize;

  return useQuery({
    queryKey: ["products", scope, params, pageSize],
    queryFn: async () => {
      const response = await fetch(`/api/products?${buildSearchParams(scope, params, pageSize)}`);
      if (!response.ok) throw new Error("Failed to load products");
      return (await response.json()) as ProductListingResult;
    },
    initialData,
  });
}
