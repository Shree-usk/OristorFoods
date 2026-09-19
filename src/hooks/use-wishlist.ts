export interface UseWishlistResult {
  isWishlisted: boolean;
  isAvailable: boolean;
  toggle: () => void;
}

/**
 * Stub until STORY-013 (Wishlist) lands — same contract/rationale as
 * useAddToCart. Replace this implementation (not its call sites).
 */
export function useWishlist(_productId: string): UseWishlistResult {
  return { isWishlisted: false, isAvailable: false, toggle: () => {} };
}
