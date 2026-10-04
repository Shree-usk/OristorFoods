import { RecipeAssistantTrigger } from "@/components/storefront/ai/recipe-assistant-trigger";
import { listRecipeFacets } from "@/services/recipe.service";

/**
 * STORY-062. The one shared entry point — fetches the same facet
 * data recipe-filter-controls.tsx already renders from
 * (listRecipeFacets), so the widget's filter chips use the exact
 * same source of truth rather than a duplicate query. An async
 * Server Component a sync parent renders directly, same pattern
 * STORY-060's featured-recipes.tsx/best-selling-products.tsx
 * established.
 */
export async function RecipeAssistantEntryPoint() {
  const facets = await listRecipeFacets();
  return <RecipeAssistantTrigger dietaryTagOptions={facets.dietaryTags} categoryOptions={facets.categories} />;
}
