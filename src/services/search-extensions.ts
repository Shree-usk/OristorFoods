export interface SearchSuggestionItem {
  id: string;
  label: string;
  href: string;
  imageSrc?: string;
  type: "Product" | "Recipe";
}

export type SearchRecipes = (query: string, limit: number) => Promise<SearchSuggestionItem[]>;

let recipeSearchProvider: SearchRecipes = async () => [];

/**
 * Epic 04 (Recipes & Food Academy) — and later STORY-061 (AI Smart
 * Search) — calls this from its own service module's init to plug real
 * recipe search results into Global Search, without search.service.ts
 * importing a module that doesn't exist yet. Same contract/rationale as
 * product-detail-extensions.ts's register*Provider functions.
 */
export function registerRecipeSearchProvider(provider: SearchRecipes) {
  recipeSearchProvider = provider;
}

export function searchRecipes(query: string, limit: number) {
  return recipeSearchProvider(query, limit);
}

/** Test-only: restores the provider to its default stub. */
export function resetSearchExtensionsForTesting() {
  recipeSearchProvider = async () => [];
}
