import { create } from "zustand";

/**
 * Count-only client state for the header's wishlist badge. The full
 * wishlist (saved products, guest/logged-in merge) is owned by
 * STORY-013 (Wishlist) — extend or replace this store there rather than
 * introducing a second wishlist store.
 */
interface WishlistState {
  count: number;
  setCount: (count: number) => void;
  increment: (by?: number) => void;
  decrement: (by?: number) => void;
}

export const useWishlistStore = create<WishlistState>((set) => ({
  count: 0,
  setCount: (count) => set({ count: Math.max(0, count) }),
  increment: (by = 1) => set((state) => ({ count: state.count + by })),
  decrement: (by = 1) => set((state) => ({ count: Math.max(0, state.count - by) })),
}));
