"use client";

import { useCart } from "@/hooks/use-cart";

export interface UseAddToCartResult {
  isAvailable: boolean;
  addToCart: (quantity?: number) => void;
}

export function useAddToCart(productId: string): UseAddToCartResult {
  const { addItem } = useCart();
  return {
    isAvailable: true,
    addToCart: (quantity = 1) => addItem(productId, quantity),
  };
}
