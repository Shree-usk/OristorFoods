import { create } from "zustand";

interface CompareState {
  items: string[];
  add: (productId: string) => "added" | "duplicate" | "full";
  remove: (productId: string) => void;
  has: (productId: string) => boolean;
  clear: () => void;
}

/**
 * Compare tray — STORY-014. Deliberately NOT persisted (no `persist`
 * middleware, unlike wishlist-store.ts): the story requires this to clear
 * on session end, not survive a browser restart. Session-only in-memory
 * Zustand state.
 */
export const useCompareStore = create<CompareState>((set, get) => ({
  items: [],
  add: (productId) => {
    const { items } = get();
    if (items.includes(productId)) return "duplicate";
    if (items.length >= 4) return "full";
    set({ items: [...items, productId] });
    return "added";
  },
  remove: (productId) => set({ items: get().items.filter((id) => id !== productId) }),
  has: (productId) => get().items.includes(productId),
  clear: () => set({ items: [] }),
}));
