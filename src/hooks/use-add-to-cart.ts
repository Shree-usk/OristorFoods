"use client";

import { useCart } from "@/hooks/use-cart";
import { useUiStore } from "@/lib/stores/use-ui-store";

export interface UseAddToCartResult {
  isAvailable: boolean;
  addToCart: (quantity?: number) => void;
  isAdding: boolean;
  error: string | null;
}

/** Story 3 (Custom Packaging). Optional — omitted entirely for a product with no packaging selector. */
export interface PackagingSelectionArg {
  packagingOptionId: string;
  declaredAvailability: "Local" | "Export";
}

export function useAddToCart(productId: string, variantId?: string | null, packaging?: PackagingSelectionArg | null): UseAddToCartResult {
  const { addItem, isAddingItem, addItemError } = useCart();
  const openCartDrawer = useUiStore((state) => state.openCartDrawer);
  return {
    isAvailable: true,
    // Opens the cart drawer as the add-to-cart confirmation instead of a
    // silent mutation — reuses the existing drawer (line items + cross-sell)
    // rather than building a separate confirmation UI.
    addToCart: (quantity = 1) => addItem(productId, quantity, { onSuccess: openCartDrawer }, variantId, packaging),
    isAdding: isAddingItem,
    error: addItemError,
  };
}
