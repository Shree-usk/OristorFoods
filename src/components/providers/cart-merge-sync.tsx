"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

/**
 * Watches for the unauthenticated -> authenticated session transition and
 * merges the guest cart (identified server-side by the still-present
 * guest cookie) into the user's account cart exactly once per transition.
 * Mirrors WishlistMergeSync's mechanism exactly — no login page/event
 * exists yet in this codebase, so this reacts to session state rather
 * than a login submit handler. Unlike WishlistMergeSync, there's no
 * client-side guest state to read first: the merge endpoint resolves the
 * guest cart itself from the request's own cookie.
 */
export function CartMergeSync() {
  const { status } = useSession();
  const queryClient = useQueryClient();
  const prevStatus = useRef(status);

  useEffect(() => {
    const justAuthenticated = prevStatus.current !== "authenticated" && status === "authenticated";
    prevStatus.current = status;
    if (!justAuthenticated) return;

    fetch("/api/cart/merge", { method: "POST", credentials: "include" })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["cart"] });
      })
      .catch(() => {
        // Merge failure leaves the guest cookie/cart intact server-side,
        // so it's retried on the next authenticated transition.
      });
  }, [status, queryClient]);

  return null;
}
