"use client";

import { useQueryStates } from "nuqs";

import { productListingParsers } from "@/lib/product-listing-params";

export function useProductListingParams() {
  return useQueryStates(productListingParsers);
}
