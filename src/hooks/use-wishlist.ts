export interface UseWishlistResult {
  isWishlisted: boolean;
  isAvailable: boolean;
  toggle: () => void;
}

/**
 * Stub until STORY-013 (Wishlist) lands — same contract/rationale as
 * useAddToCart. Replace this implementation (not its call sites).
 */
// _productId is kept in the signature so call sites already pass it and
// won't need updating once STORY-013 replaces this stub with a real
// implementation.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useWishlist(_productId: string): UseWishlistResult {
  return { isWishlisted: false, isAvailable: false, toggle: () => {} };
}
