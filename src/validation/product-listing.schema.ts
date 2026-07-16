import { z } from "zod";

export const productSortValues = ["price-asc", "price-desc", "newest", "best-selling", "rating"] as const;

/**
 * A comma-separated query value (matches `nuqs`'s `parseAsArrayOf` client-side
 * serialization, e.g. `?brands=oristor,mccormick` — not repeated keys).
 */
const commaSeparatedList = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  )
  .optional()
  .catch(undefined);

/**
 * `.catch()` (not `.default()`) on every field: `.default()` only fills in a
 * *missing* value, but a malformed request (e.g. `sort=garbage`) must still
 * return 200 with sane defaults rather than reject the whole request — a
 * broken filter link elsewhere on the site shouldn't break this page for the
 * visitor who clicked it.
 */
export const productListingQuerySchema = z.object({
  category: z.string().optional().catch(undefined),
  collection: z.string().optional().catch(undefined),
  page: z.coerce.number().int().positive().catch(1),
  pageSize: z.coerce.number().int().positive().max(60).catch(24),
  sort: z.enum(productSortValues).catch("newest"),
  priceMin: z.coerce.number().nonnegative().optional().catch(undefined),
  priceMax: z.coerce.number().nonnegative().optional().catch(undefined),
  allergens: commaSeparatedList,
  certifications: commaSeparatedList,
  brands: commaSeparatedList,
  inStock: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional()
    .catch(undefined),
});

export type ProductListingQuery = z.infer<typeof productListingQuerySchema>;
