"use client";

import { useCart } from "@/hooks/use-cart";
import { useUiStore } from "@/lib/stores/use-ui-store";

export interface UseAddToCartResult {
  isAvailable: boolean;
  addToCart: (quantity?: number) => void;
  isAdding: boolean;
  error: string | null;
}

export function useAddToCart(productId: string): UseAddToCartResult {
  const { addItem, isAddingItem, addItemError } = useCart();
  const openCartDrawer = useUiStore((state) => state.openCartDrawer);
  return {
    isAvailable: true,
    // Opens the cart drawer as the add-to-cart confirmation instead of a
    // silent mutation — reuses the existing drawer (line items + cross-sell)
    // rather than building a separate confirmation UI.
    addToCart: (quantity = 1) => addItem(productId, quantity, { onSuccess: openCartDrawer }),
    isAdding: isAddingItem,
    error: addItemError,
  };
}
