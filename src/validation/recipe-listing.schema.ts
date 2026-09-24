import { z } from "zod";

import { recipeDifficultyValues, recipeSortValues, recipeTimeValues } from "@/lib/recipe-listing-values";

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Comma-separated list restricted to known values. Unknown values are
 * dropped, not rejected, so a stale bookmark still loads.
 */
function knownValues<const T extends readonly string[]>(allowed: T) {
  return z
    .string()
    .transform((value) =>
      splitList(value).filter((item): item is T[number] => (allowed as readonly string[]).includes(item)),
    )
    .optional()
    .catch(undefined);
}

/**
 * Query contract for /recipes and GET /api/recipes. Every field uses
 * `.catch()`, so a malformed or stale query never fails the request. It
 * falls back to defaults instead (same policy as productListingQuerySchema).
 * `.transform()` comes before `.optional()` so inferred keys stay optional.
 */
export const recipeListingQuerySchema = z.object({
  category: z.string().trim().min(1).optional().catch(undefined),
  difficulty: knownValues(recipeDifficultyValues),
  time: knownValues(recipeTimeValues),
  // Unknown dietary slugs are kept: they simply match no recipes.
  diet: z.string().transform(splitList).optional().catch(undefined),
  q: z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.slice(0, 100))
    .optional()
    .catch(undefined),
  sort: z.enum(recipeSortValues).catch("newest"),
  page: z.coerce.number().int().positive().catch(1),
  pageSize: z.coerce.number().int().positive().max(48).catch(12),
});

export type RecipeListingQuery = z.infer<typeof recipeListingQuerySchema>;
