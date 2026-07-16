import { createLoader } from "nuqs/server";

import { productListingParsers } from "@/lib/product-listing-params";

/**
 * Parses the App Router `searchParams` prop (a `Promise` in Next.js 15/16)
 * using the exact same parser definitions the client hook uses. Kept in its
 * own file (rather than alongside the parsers) because `nuqs/server` is a
 * server-only import — `product-listing-params.ts` stays safe to import
 * from a "use client" file, this file is only ever imported by page.tsx
 * Server Components.
 */
export const loadProductListingParams = createLoader(productListingParsers);
