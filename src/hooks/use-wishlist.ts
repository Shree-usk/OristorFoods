"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { addWishlistItem, fetchWishlist, removeWishlistItem } from "@/lib/api/wishlist-client";
import { useWishlistStore } from "@/lib/stores/wishlist-store";
import type { ProductListItem } from "@/types/product";

export interface UseWishlistResult {
  isWishlisted: boolean;
  isAvailable: boolean;
  toggle: () => void;
}

interface ToggleContext {
  previousItems: ProductListItem[] | undefined;
}

function optimisticPlaceholder(productId: string): ProductListItem {
  return {
    id: productId,
    name: "",
    href: "",
    imageSrc: "",
    imageAlt: "",
    price: 0,
    currency: "LKR",
    inStock: false,
  };
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

  const toggleMutation = useMutation<void, Error, void, ToggleContext>({
    mutationFn: async () => {
      if (isServerWishlisted) {
        await removeWishlistItem(productId);
      } else {
        await addWishlistItem(productId);
      }
    },
    // Optimistic update (design spec, `useWishlist` section): the toggle
    // button must flip immediately for signed-in users too, not only after
    // the POST/DELETE round-trip and refetch. Standard TanStack Query
    // shape — cancel in-flight reads, snapshot, write, roll back on error.
    onMutate: async (): Promise<ToggleContext> => {
      await queryClient.cancelQueries({ queryKey: ["wishlist"] });
      const previousItems = queryClient.getQueryData<ProductListItem[]>(["wishlist"]);

      queryClient.setQueryData<ProductListItem[]>(["wishlist"], (current) => {
        const list = current ?? [];
        if (list.some((item) => item.id === productId)) {
          return list.filter((item) => item.id !== productId);
        }
        // Placeholder row — only the id is consulted for `isWishlisted`,
        // and onSuccess's invalidateQueries replaces it with the real
        // product record as soon as the refetch lands. Fully typed rather
        // than cast so a future reader of this cache can't trip over an
        // unexpectedly-missing field.
        return [...list, optimisticPlaceholder(productId)];
      });

      return { previousItems };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      if (context.previousItems === undefined) {
        // setQueryData(key, undefined) is a no-op in TanStack Query, so the
        // optimistic row would survive — drop the entry outright instead.
        queryClient.removeQueries({ queryKey: ["wishlist"], exact: true });
        return;
      }
      queryClient.setQueryData<ProductListItem[]>(["wishlist"], context.previousItems);
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
