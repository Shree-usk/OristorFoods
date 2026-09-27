import { create } from "zustand";
import { persist } from "zustand/middleware";

interface RecipeBookmarkState {
  items: string[];
  add: (recipeId: string) => void;
  remove: (recipeId: string) => void;
  has: (recipeId: string) => boolean;
  clear: () => void;
}

/**
 * Guest (unauthenticated) recipe bookmarks, persisted to localStorage —
 * STORY-022. Mirrors wishlist-store.ts's shape exactly (add/remove/has/clear
 * over a plain string[]). Logged-in customers' bookmarks live server-side
 * (see recipe-bookmark.service.ts) and are fetched via useRecipeBookmark's
 * TanStack Query branch instead; this store is only the guest path.
 */
export const useRecipeBookmarkStore = create<RecipeBookmarkState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (recipeId) => {
        if (get().items.includes(recipeId)) return;
        set({ items: [...get().items, recipeId] });
      },
      remove: (recipeId) => set({ items: get().items.filter((id) => id !== recipeId) }),
      has: (recipeId) => get().items.includes(recipeId),
      clear: () => set({ items: [] }),
    }),
    { name: "oristor-recipe-bookmarks" },
  ),
);
