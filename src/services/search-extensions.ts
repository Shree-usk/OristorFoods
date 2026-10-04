export interface SearchSuggestionItem {
  id: string;
  label: string;
  href: string;
  imageSrc?: string;
  type: "Product" | "Recipe" | "BlogPost" | "FoodAcademyEntry";
}

export type SearchContentProvider = (query: string, limit: number) => Promise<SearchSuggestionItem[]>;

interface SearchProviders {
  recipes: SearchContentProvider;
  // STORY-061. Same shape as recipes — registered at startup from
  // instrumentation.ts, so search.service.ts never imports blog/Food
  // Academy code directly either.
  blog: SearchContentProvider;
  foodAcademy: SearchContentProvider;
}

function defaultProviders(): SearchProviders {
  return { recipes: async () => [], blog: async () => [], foodAcademy: async () => [] };
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
 * registerRecipeProviders() in src/instrumentation.ts, so
 * search.service.ts never imports recipe code.
 */
export function registerRecipeSearchProvider(provider: SearchContentProvider) {
  providers.recipes = provider;
}

/** STORY-061. Registered from blog.service.ts's own registerBlogProviders(). */
export function registerBlogSearchProvider(provider: SearchContentProvider) {
  providers.blog = provider;
}

/** STORY-061. Registered from food-academy.service.ts's own registerFoodAcademyProviders(). */
export function registerFoodAcademySearchProvider(provider: SearchContentProvider) {
  providers.foodAcademy = provider;
}

export function searchRecipes(query: string, limit: number) {
  return providers.recipes(query, limit);
}

export function searchBlogPosts(query: string, limit: number) {
  return providers.blog(query, limit);
}

export function searchFoodAcademy(query: string, limit: number) {
  return providers.foodAcademy(query, limit);
}

/** Test-only: restores every provider to its default stub. */
export function resetSearchExtensionsForTesting() {
  const defaults = defaultProviders();
  providers.recipes = defaults.recipes;
  providers.blog = defaults.blog;
  providers.foodAcademy = defaults.foodAcademy;
}
