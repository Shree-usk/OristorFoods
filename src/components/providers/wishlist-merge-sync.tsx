"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { useWishlistStore } from "@/lib/stores/wishlist-store";

/**
 * Watches for the unauthenticated -> authenticated session transition and
 * merges any guest (localStorage) wishlist items into the user's
 * server-side wishlist exactly once per transition. No login page exists
 * yet in this codebase — this reacts to session state rather than a login
 * submit handler, so it works regardless of which future story builds the
 * actual sign-in form. See docs/superpowers/specs/2026-09-21-wishlist-design.md.
 */
export function WishlistMergeSync() {
  const { status } = useSession();
  const queryClient = useQueryClient();
  const prevStatus = useRef(status);

  useEffect(() => {
    const justAuthenticated = prevStatus.current !== "authenticated" && status === "authenticated";
    prevStatus.current = status;
    if (!justAuthenticated) return;

    const guestItems = useWishlistStore.getState().items;
    if (guestItems.length === 0) return;

    fetch("/api/wishlist/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds: guestItems }),
    })
      .then(() => {
        useWishlistStore.getState().clear();
        queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      })
      .catch(() => {
        // Merge failure leaves the guest store intact, so it's retried on
        // the next authenticated transition rather than silently losing
        // the user's items.
      });
  }, [status, queryClient]);

  return null;
}
