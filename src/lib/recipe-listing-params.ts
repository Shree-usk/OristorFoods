import {
  createSerializer,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import { recipeDifficultyValues, recipeSortValues, recipeTimeValues } from "@/lib/recipe-listing-values";

/**
 * The recipe listing's URL state (see recipe-listing-values.ts for the
 * contract). Client-safe: nuqs/server's parsers and serializer have no
 * server-only dependencies (product-listing-params.ts does the same).
 * `pageSize` is API-only and never in the page URL.
 */
export const recipeListingParsers = {
  category: parseAsString,
  difficulty: parseAsArrayOf(parseAsStringLiteral(recipeDifficultyValues)),
  time: parseAsArrayOf(parseAsStringLiteral(recipeTimeValues)),
  diet: parseAsArrayOf(parseAsString),
  q: parseAsString,
  sort: parseAsStringLiteral(recipeSortValues).withDefault("newest"),
  page: parseAsInteger.withDefault(1),
};

/** Builds `/recipes?...` hrefs (e.g. category chips) with defaults omitted. */
export const serializeRecipeListing = createSerializer(recipeListingParsers);
