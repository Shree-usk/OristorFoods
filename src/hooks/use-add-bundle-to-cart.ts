"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useUiStore } from "@/lib/stores/use-ui-store";

export interface BundleSelectionInput {
  bundleItemId: string;
  quantity: number;
}

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
 * Mirrors use-add-to-cart.ts's own shape — opens the cart drawer as the
 * confirmation, same as a plain add-to-cart.
 */
export function useAddBundleToCart(bundleId: string) {
  const queryClient = useQueryClient();
  const openCartDrawer = useUiStore((state) => state.openCartDrawer);

  const mutation = useMutation({
    mutationFn: async (selections: BundleSelectionInput[] | null) => {
      const response = await fetch("/api/cart/bundle", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundleId, selections }),
      });
      if (!response.ok) await throwWithServerMessage(response, "Failed to add bundle to cart");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      window.dispatchEvent(new Event("oristor:add-to-cart"));
      openCartDrawer();
    },
  });

  return {
    addBundleToCart: (selections: BundleSelectionInput[] | null) => mutation.mutate(selections),
    isAdding: mutation.isPending,
    error: mutation.error?.message ?? null,
  };
}
