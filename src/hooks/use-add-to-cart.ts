"use client";

import { useCart } from "@/hooks/use-cart";

export interface UseAddToCartResult {
  isAvailable: boolean;
  addToCart: (quantity?: number) => void;
  isAdding: boolean;
  error: string | null;
}

export function useAddToCart(productId: string): UseAddToCartResult {
  const { addItem, isAddingItem, addItemError } = useCart();
  return {
    isAvailable: true,
    addToCart: (quantity = 1) => addItem(productId, quantity),
    isAdding: isAddingItem,
    error: addItemError,
  };
}
