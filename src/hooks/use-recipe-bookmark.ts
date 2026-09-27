"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { addRecipeBookmark, fetchBookmarkedRecipes, removeRecipeBookmark } from "@/lib/api/recipe-bookmark-client";
import { useRecipeBookmarkStore } from "@/lib/stores/recipe-bookmark-store";
import type { RecipeCard } from "@/types/recipe";

export interface UseRecipeBookmarkResult {
  isBookmarked: boolean;
  isAvailable: boolean;
  toggle: () => void;
}

interface ToggleContext {
  previousItems: RecipeCard[] | undefined;
}

function optimisticPlaceholder(recipeId: string): RecipeCard {
  return {
    id: recipeId,
    slug: "",
    href: "",
    title: "",
    heroImage: "",
    heroImageAlt: "",
    categoryName: "",
    cuisine: null,
    difficulty: "Easy",
    totalTimeMinutes: 0,
    avgRating: null,
    ratingCount: 0,
    dietaryTags: [],
    hasVideo: false,
  };
}

export function useRecipeBookmark(recipeId: string, recipeSlug: string): UseRecipeBookmarkResult {
  const { status } = useSession();
  const queryClient = useQueryClient();
  const isAuthenticated = status === "authenticated";

  const guestHas = useRecipeBookmarkStore((state) => state.has(recipeId));
  const guestAdd = useRecipeBookmarkStore((state) => state.add);
  const guestRemove = useRecipeBookmarkStore((state) => state.remove);

  const { data: items } = useQuery({
    queryKey: ["recipe-bookmarks"],
    queryFn: fetchBookmarkedRecipes,
    enabled: isAuthenticated,
  });

  const isServerBookmarked = (items ?? []).some((item) => item.id === recipeId);
  const isBookmarked = isAuthenticated ? isServerBookmarked : guestHas;

  const toggleMutation = useMutation<void, Error, void, ToggleContext>({
    mutationFn: async () => {
      if (isServerBookmarked) {
        await removeRecipeBookmark(recipeSlug);
      } else {
        await addRecipeBookmark(recipeSlug);
      }
    },
    // Optimistic update, same shape as useWishlist: the toggle must flip
    // immediately for signed-in customers too, not only after the
    // POST/DELETE round-trip and refetch.
    onMutate: async (): Promise<ToggleContext> => {
      await queryClient.cancelQueries({ queryKey: ["recipe-bookmarks"] });
      const previousItems = queryClient.getQueryData<RecipeCard[]>(["recipe-bookmarks"]);

      queryClient.setQueryData<RecipeCard[]>(["recipe-bookmarks"], (current) => {
        const list = current ?? [];
        if (list.some((item) => item.id === recipeId)) {
          return list.filter((item) => item.id !== recipeId);
        }
        // Placeholder row — only `id` is consulted for `isBookmarked`, and
        // onSuccess's invalidateQueries replaces it with the real recipe
        // record as soon as the refetch lands.
        return [...list, optimisticPlaceholder(recipeId)];
      });

      return { previousItems };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      if (context.previousItems === undefined) {
        queryClient.removeQueries({ queryKey: ["recipe-bookmarks"], exact: true });
        return;
      }
      queryClient.setQueryData<RecipeCard[]>(["recipe-bookmarks"], context.previousItems);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipe-bookmarks"] });
    },
  });

  function toggle() {
    if (isAuthenticated) {
      toggleMutation.mutate();
    } else if (guestHas) {
      guestRemove(recipeId);
    } else {
      guestAdd(recipeId);
    }
  }

  return { isBookmarked, isAvailable: true, toggle };
}
