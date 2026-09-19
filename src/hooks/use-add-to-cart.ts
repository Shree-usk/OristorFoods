export interface UseAddToCartResult {
  isAvailable: boolean;
  addToCart: (quantity?: number) => void;
}

/**
 * Stub until STORY-024 (Shopping Cart) lands — always reports unavailable
 * so the PDP renders a disabled control instead of a fake add-to-cart.
 * Replace this implementation (not its call sites) when STORY-024 ships.
 */
export function useAddToCart(_productId: string): UseAddToCartResult {
  return { isAvailable: false, addToCart: () => {} };
}
