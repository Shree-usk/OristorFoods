import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsFloat,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs";

export const productSortValues = ["price-asc", "price-desc", "newest", "best-selling", "rating"] as const;

/**
 * Single source of truth for the product-listing URL query state — shared
 * verbatim by the client `useProductListingParams()` hook (`useQueryStates`,
 * see `use-product-listing-params.ts`) and the server-side
 * `loadProductListingParams()` loader (`createLoader`, see
 * `product-listing-loader.ts`). Both are built from this same object, so the
 * client and server always agree on field names, types, and defaults.
 *
 * `pageSize` is deliberately not included here — the client UI never lets a
 * visitor change it, so it never needs to round-trip through the URL (see
 * Global Constraints in the plan this was built from).
 */
export const productListingParsers = {
  page: parseAsInteger.withDefault(1),
  sort: parseAsStringLiteral(productSortValues).withDefault("newest"),
  priceMin: parseAsFloat,
  priceMax: parseAsFloat,
  allergens: parseAsArrayOf(parseAsString),
  certifications: parseAsArrayOf(parseAsString),
  brands: parseAsArrayOf(parseAsString),
  inStock: parseAsBoolean,
};
