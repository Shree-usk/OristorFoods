export interface SearchSuggestionItem {
  id: string;
  label: string;
  href: string;
  imageSrc?: string;
  type: "Product" | "Recipe";
}

export type SearchRecipes = (query: string, limit: number) => Promise<SearchSuggestionItem[]>;

interface SearchProviders {
  recipes: SearchRecipes;
}

function defaultProviders(): SearchProviders {
  return { recipes: async () => [] };
}

// Kept on globalThis, not in module scope. Providers register at server
// startup from src/instrumentation.ts, which Next.js bundles separately from
// the route code that reads them, so each bundle gets its own copy of this
// module. globalThis is shared by both within the server process (same
// reason as product-detail-extensions.ts).
const globalForSearch = globalThis as unknown as { __oristorSearchProviders?: SearchProviders };
const providers = (globalForSearch.__oristorSearchProviders ??= defaultProviders());

/**
 * Epic 04 (Recipes & Food Academy) registers this through
 * registerRecipeProviders() in src/instrumentation.ts (and later STORY-061,
 * AI Smart Search), so search.service.ts never imports recipe code.
 */
export function registerRecipeSearchProvider(provider: SearchRecipes) {
  providers.recipes = provider;
}

export function searchRecipes(query: string, limit: number) {
  return providers.recipes(query, limit);
}

/** Test-only: restores the provider to its default stub. */
export function resetSearchExtensionsForTesting() {
  providers.recipes = defaultProviders().recipes;
}
