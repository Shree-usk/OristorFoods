import type { RecipeCard } from "@/types/recipe";

/**
 * STORY-037. Client-safe — deliberately its own file, not part of
 * customer-saved-recipes.service.ts, whose other export
 * (getSavedRecipesForCustomer) transitively imports Prisma/pg via
 * recipe-bookmark.service.ts → recipe-bookmark.repository.ts → lib/db.ts.
 * A Client Component (saved-recipes-view.tsx) importing anything from that
 * service file would pull that whole module graph into the browser bundle
 * (Next.js resolves a file's imports as a unit at the client/server
 * boundary, not per named export) and fail to build ("Module not found:
 * Can't resolve 'dns'"). This file has no server-only imports.
 */

export type SavedRecipesSort = "dateSaved" | "alphabetical";

/**
 * Pure. No domain RecipeSort value covers "date-saved" or "alphabetical"
 * (buildRecipeOrderBy only knows newest/popular/rating/time), so this story
 * defines its own small sort. `dateSaved` preserves the input order (already
 * most-recently-bookmarked-first from listBookmarksForCustomer); `category`
 * matches RecipeCard.categoryName exactly — the type carries no category
 * slug, and filter options are the distinct names present in the customer's
 * own saved list, not the site-wide facet list.
 */
export function filterAndSortSavedRecipes(recipes: RecipeCard[], options: { category?: string; sort: SavedRecipesSort }): RecipeCard[] {
  const filtered = options.category ? recipes.filter((recipe) => recipe.categoryName === options.category) : recipes;
  if (options.sort === "alphabetical") {
    return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
  }
  return filtered;
}
