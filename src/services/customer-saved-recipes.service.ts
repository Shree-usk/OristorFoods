import { listBookmarksForCustomer } from "@/services/recipe-bookmark.service";
import type { RecipeCard } from "@/types/recipe";

/**
 * STORY-037. Presentation-only composition for `/account/saved-recipes` —
 * reads what STORY-022's recipe-bookmark.service.ts already computes; no
 * bookmark data model, toggle mechanism, or save/unsave rule is defined
 * here. Server-only (touches Prisma transitively) — see
 * lib/saved-recipes-filter.ts for the client-safe filter/sort logic this
 * page's Client Component uses instead.
 */
export function getSavedRecipesForCustomer(userId: string): Promise<RecipeCard[]> {
  return listBookmarksForCustomer(userId);
}
