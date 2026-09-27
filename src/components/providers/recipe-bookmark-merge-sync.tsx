"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { useRecipeBookmarkStore } from "@/lib/stores/recipe-bookmark-store";

/**
 * Watches for the unauthenticated -> authenticated session transition and
 * merges any guest (localStorage) recipe bookmarks into the customer's
 * server-side bookmarks exactly once per transition. Mirrors
 * wishlist-merge-sync.tsx's shape exactly.
 */
export function RecipeBookmarkMergeSync() {
  const { status } = useSession();
  const queryClient = useQueryClient();
  const prevStatus = useRef(status);

  useEffect(() => {
    const justAuthenticated = prevStatus.current !== "authenticated" && status === "authenticated";
    prevStatus.current = status;
    if (!justAuthenticated) return;

    const guestItems = useRecipeBookmarkStore.getState().items;
    if (guestItems.length === 0) return;

    fetch("/api/recipes/bookmarks/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipeIds: guestItems }),
    })
      .then(() => {
        useRecipeBookmarkStore.getState().clear();
        queryClient.invalidateQueries({ queryKey: ["recipe-bookmarks"] });
      })
      .catch(() => {
        // Merge failure leaves the guest store intact, so it's retried on
        // the next authenticated transition rather than silently losing
        // the customer's bookmarks.
      });
  }, [status, queryClient]);

  return null;
}
