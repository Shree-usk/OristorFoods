"use client";

import { useQueryStates, type Values } from "nuqs";

import { recipeListingParsers } from "@/lib/recipe-listing-params";

export type RecipeListingParams = Values<typeof recipeListingParsers>;

/**
 * Filter, sort and page changes push a history entry so Back/Forward walk
 * through them. The search box overrides this with `{ history: "replace" }`
 * so typing doesn't create one entry per keystroke.
 */
export function useRecipeListingParams() {
  return useQueryStates(recipeListingParsers, { history: "push" });
}
