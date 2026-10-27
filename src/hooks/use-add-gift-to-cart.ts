"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useUiStore } from "@/lib/stores/use-ui-store";

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

/**
 * Mirrors use-add-bundle-to-cart.ts's own shape — opens the cart drawer as
 * the confirmation, same as a plain add-to-cart.
 */
export function useAddGiftToCart(giftOfferId: string) {
  const queryClient = useQueryClient();
  const openCartDrawer = useUiStore((state) => state.openCartDrawer);

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/cart/gift", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ giftOfferId }),
      });
      if (!response.ok) await throwWithServerMessage(response, "Failed to add gift to cart");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      window.dispatchEvent(new Event("oristor:add-to-cart"));
      openCartDrawer();
    },
  });

  return {
    addGiftToCart: () => mutation.mutate(),
    isAdding: mutation.isPending,
    error: mutation.error?.message ?? null,
  };
}
