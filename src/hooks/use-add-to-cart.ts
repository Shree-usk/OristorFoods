export interface UseAddToCartResult {
  isAvailable: boolean;
  addToCart: (quantity?: number) => void;
}

/**
 * Stub until STORY-024 (Shopping Cart) lands — always reports unavailable
 * so the PDP renders a disabled control instead of a fake add-to-cart.
 * Replace this implementation (not its call sites) when STORY-024 ships.
 */
// _productId is kept in the signature so call sites already pass it and
// won't need updating once STORY-024 replaces this stub with a real
// implementation.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useAddToCart(_productId: string): UseAddToCartResult {
  return { isAvailable: false, addToCart: () => {} };
}
