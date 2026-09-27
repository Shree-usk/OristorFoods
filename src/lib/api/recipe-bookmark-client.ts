import type { RecipeCard } from "@/types/recipe";

/**
 * Shared client-side wrapper around the recipe bookmark HTTP API —
 * STORY-022. Every function checks `response.ok` and throws on a non-2xx,
 * so callers (TanStack Query mutations, or an explicit `.catch()`) can
 * surface the failure instead of silently treating a 401/404/500 as
 * success. Mirrors wishlist-client.ts's shape.
 */

function assertOk(response: Response, message: string): void {
  if (!response.ok) {
    throw new Error(`${message} (${response.status})`);
  }
}

/** GET /api/recipes/bookmarks — the signed-in customer's bookmarked recipes. */
export async function fetchBookmarkedRecipes(): Promise<RecipeCard[]> {
  const response = await fetch("/api/recipes/bookmarks");
  assertOk(response, "Failed to load bookmarks");
  const body: { items: RecipeCard[] } = await response.json();
  return body.items;
}

/** POST /api/recipes/:slug/bookmark — bookmarks a recipe for the signed-in customer. */
export async function addRecipeBookmark(recipeSlug: string): Promise<void> {
  const response = await fetch(`/api/recipes/${encodeURIComponent(recipeSlug)}/bookmark`, { method: "POST" });
  assertOk(response, "Failed to bookmark recipe");
}

/** DELETE /api/recipes/:slug/bookmark — removes a recipe bookmark for the signed-in customer. */
export async function removeRecipeBookmark(recipeSlug: string): Promise<void> {
  const response = await fetch(`/api/recipes/${encodeURIComponent(recipeSlug)}/bookmark`, { method: "DELETE" });
  assertOk(response, "Failed to remove bookmark");
}
