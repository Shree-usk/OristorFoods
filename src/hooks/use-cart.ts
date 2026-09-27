"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CartSummary } from "@/types/cart";

async function fetchCart(): Promise<CartSummary> {
  const response = await fetch("/api/cart", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to load cart");
  return response.json() as Promise<CartSummary>;
}

export function useCart() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["cart"], queryFn: fetchCart });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["cart"] });

  const addItemMutation = useMutation({
    mutationFn: async ({ productId, quantity }: { productId: string; quantity: number }) => {
      const response = await fetch("/api/cart/items", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity }),
      });
      if (!response.ok) throw new Error("Failed to add to cart");
    },
    onSuccess: invalidate,
  });

  const updateQuantityMutation = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      const response = await fetch(`/api/cart/items/${itemId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });
      if (!response.ok) throw new Error("Failed to update quantity");
    },
    onSuccess: invalidate,
  });

  const removeItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const response = await fetch(`/api/cart/items/${itemId}`, { method: "DELETE", credentials: "include" });
      if (!response.ok) throw new Error("Failed to remove item");
    },
    onSuccess: invalidate,
  });

  return {
    cart: query.data,
    isPending: query.isPending,
    addItem: (productId: string, quantity = 1) => addItemMutation.mutate({ productId, quantity }),
    updateQuantity: (itemId: string, quantity: number) => updateQuantityMutation.mutate({ itemId, quantity }),
    removeItem: (itemId: string) => removeItemMutation.mutate(itemId),
  };
}
