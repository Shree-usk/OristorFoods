"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CartSummary } from "@/types/cart";

async function fetchCart(): Promise<CartSummary> {
  const response = await fetch("/api/cart", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to load cart");
  return response.json() as Promise<CartSummary>;
}

/**
 * Reads the server's `{ error }` body (all cart routes' error responses
 * carry one, see cart-responses.ts) so a stock-exceeded/unavailable
 * rejection surfaces its real message ("Only 2 left in stock") instead of
 * a generic fallback — falls back to `fallbackMessage` only when the body
 * isn't the expected shape (e.g. a network failure with no response).
 */
async function throwWithServerMessage(response: Response, fallbackMessage: string): Promise<never> {
  let message = fallbackMessage;
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error) message = body.error;
  } catch {
    // Non-JSON or empty body — keep the fallback.
  }
  throw new Error(message);
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
      if (!response.ok) await throwWithServerMessage(response, "Failed to add to cart");
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
      if (!response.ok) await throwWithServerMessage(response, "Failed to update quantity");
    },
    onSuccess: invalidate,
  });

  const removeItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const response = await fetch(`/api/cart/items/${itemId}`, { method: "DELETE", credentials: "include" });
      if (!response.ok) await throwWithServerMessage(response, "Failed to remove item");
    },
    onSuccess: invalidate,
  });

  // STORY-029. Applying/removing a coupon changes the total, so — like
  // every other cart mutation here — it invalidates ["cart"] rather than
  // trying to locally patch the cached summary; any component reading
  // the cart (cart drawer, checkout Review step) picks up the new
  // discount automatically.
  const applyCouponMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await fetch("/api/cart/coupon", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!response.ok) await throwWithServerMessage(response, "This coupon couldn't be applied.");
    },
    onSuccess: invalidate,
  });

  const removeCouponMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/cart/coupon", { method: "DELETE", credentials: "include" });
      if (!response.ok) await throwWithServerMessage(response, "Failed to remove coupon");
    },
    onSuccess: invalidate,
  });

  // STORY-030. Same invalidate-and-refetch shape as the coupon mutations
  // above — redeeming points changes the total.
  const applyPointsMutation = useMutation({
    mutationFn: async (points: number) => {
      const response = await fetch("/api/cart/points", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points }),
      });
      if (!response.ok) await throwWithServerMessage(response, "These points couldn't be applied.");
    },
    onSuccess: invalidate,
  });

  const removePointsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/cart/points", { method: "DELETE", credentials: "include" });
      if (!response.ok) await throwWithServerMessage(response, "Failed to remove points");
    },
    onSuccess: invalidate,
  });

  return {
    cart: query.data,
    isPending: query.isPending,
    addItem: (productId: string, quantity = 1) => addItemMutation.mutate({ productId, quantity }),
    updateQuantity: (itemId: string, quantity: number) => updateQuantityMutation.mutate({ itemId, quantity }),
    removeItem: (itemId: string) => removeItemMutation.mutate(itemId),
    isAddingItem: addItemMutation.isPending,
    addItemError: addItemMutation.error?.message ?? null,
    isUpdatingItemId: updateQuantityMutation.isPending ? updateQuantityMutation.variables?.itemId : undefined,
    updateQuantityError: updateQuantityMutation.isError ? { itemId: updateQuantityMutation.variables?.itemId, message: updateQuantityMutation.error.message } : null,
    isRemovingItemId: removeItemMutation.isPending ? removeItemMutation.variables : undefined,
    removeItemError: removeItemMutation.isError ? { itemId: removeItemMutation.variables, message: removeItemMutation.error.message } : null,
    applyCoupon: (code: string) => applyCouponMutation.mutateAsync(code),
    removeCoupon: () => removeCouponMutation.mutateAsync(),
    isApplyingCoupon: applyCouponMutation.isPending,
    isRemovingCoupon: removeCouponMutation.isPending,
    applyPoints: (points: number) => applyPointsMutation.mutateAsync(points),
    removePoints: () => removePointsMutation.mutateAsync(),
    isApplyingPoints: applyPointsMutation.isPending,
    isRemovingPoints: removePointsMutation.isPending,
  };
}
