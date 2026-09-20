"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { Values } from "nuqs";
import { useRef } from "react";

import { productListingParsers } from "@/lib/product-listing-params";
import type { ProductListingResult } from "@/services/product.service";

export interface ProductListingScope {
  category?: string;
  collection?: string;
  /** When set, useProductListing fetches /api/products/search instead of /api/products (STORY-012). */
  query?: string;
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
  if (scope.query) search.set("q", scope.query);
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

  // `initialData` seeds whatever queryKey is active on the render it's
  // evaluated for — passing it as a plain value would re-seed it into
  // every later filter/sort/page change too, flashing the original
  // unfiltered page while the real request for the new key is in flight.
  // Freezing the key this hook first mounted with, and only supplying
  // `initialData` when the *current* key still matches it, limits the
  // seed to the one request it actually corresponds to (the SSR render).
  // Every other transition falls through to `placeholderData:
  // keepPreviousData`, which keeps the last real results on screen
  // instead of a stale flash or a skeleton wipe.
  const initialKey = useRef(JSON.stringify(["products", scope, params, pageSize])).current;

  return useQuery({
    queryKey: ["products", scope, params, pageSize],
    queryFn: async () => {
      const endpoint = scope.query ? "/api/products/search" : "/api/products";
      const response = await fetch(`${endpoint}?${buildSearchParams(scope, params, pageSize)}`);
      if (!response.ok) throw new Error("Failed to load products");
      return (await response.json()) as ProductListingResult;
    },
    initialData: () =>
      JSON.stringify(["products", scope, params, pageSize]) === initialKey ? initialData : undefined,
    placeholderData: keepPreviousData,
  });
}
