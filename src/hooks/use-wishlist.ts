"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { useWishlistStore } from "@/lib/stores/wishlist-store";
import type { ProductListItem } from "@/types/product";

export interface UseWishlistResult {
  isWishlisted: boolean;
  isAvailable: boolean;
  toggle: () => void;
}

async function fetchWishlist(): Promise<ProductListItem[]> {
  const response = await fetch("/api/wishlist");
  if (!response.ok) throw new Error("Failed to load wishlist");
  const body: { items: ProductListItem[] } = await response.json();
  return body.items;
}

export function useWishlist(productId: string): UseWishlistResult {
  const { status } = useSession();
  const queryClient = useQueryClient();
  const isAuthenticated = status === "authenticated";

  const guestHas = useWishlistStore((state) => state.has(productId));
  const guestAdd = useWishlistStore((state) => state.add);
  const guestRemove = useWishlistStore((state) => state.remove);

  const { data: items } = useQuery({
    queryKey: ["wishlist"],
    queryFn: fetchWishlist,
    enabled: isAuthenticated,
  });

  const isServerWishlisted = (items ?? []).some((item) => item.id === productId);
  const isWishlisted = isAuthenticated ? isServerWishlisted : guestHas;

  const toggleMutation = useMutation({
    mutationFn: async () => {
      if (isServerWishlisted) {
        await fetch(`/api/wishlist/${productId}`, { method: "DELETE" });
      } else {
        await fetch("/api/wishlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId }),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    },
  });

  function toggle() {
    if (isAuthenticated) {
      toggleMutation.mutate();
    } else if (guestHas) {
      guestRemove(productId);
    } else {
      guestAdd(productId);
    }
  }

  return { isWishlisted, isAvailable: true, toggle };
}
