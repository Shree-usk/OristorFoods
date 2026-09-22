import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WishlistState {
  items: string[];
  add: (productId: string) => void;
  remove: (productId: string) => void;
  has: (productId: string) => boolean;
  clear: () => void;
}

/**
 * Guest (unauthenticated) wishlist, persisted to localStorage — STORY-013.
 * Logged-in users' wishlist lives server-side (see wishlist.service.ts)
 * and is fetched via useWishlist's TanStack Query branch instead; this
 * store is only the guest path. Same persist-without-a-hydration-boundary
 * pattern as recently-viewed-store.ts (see docs/architecture-decisions.md
 * for why that's safe here).
 */
export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (productId) => {
        if (get().items.includes(productId)) return;
        set({ items: [...get().items, productId] });
      },
      remove: (productId) => set({ items: get().items.filter((id) => id !== productId) }),
      has: (productId) => get().items.includes(productId),
      clear: () => set({ items: [] }),
    }),
    { name: "oristor-wishlist" },
  ),
);
