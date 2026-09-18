import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { RecentlyViewedItem } from "@/validation/product-detail.schema";

const MAX_ITEMS = 12;

interface RecentlyViewedState {
  items: RecentlyViewedItem[];
  add: (item: RecentlyViewedItem) => void;
}

/**
 * Client-side "recently viewed products" tracking (STORY-011). Persisted
 * to localStorage so it survives reloads without requiring login. The
 * full wishlist/cart stores in this directory follow the same
 * count-or-list-in-localStorage pattern; extend this one rather than
 * introducing a second recently-viewed store.
 */
export const useRecentlyViewedStore = create<RecentlyViewedState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item) => {
        const deduped = get().items.filter((existing) => existing.id !== item.id);
        set({ items: [item, ...deduped].slice(0, MAX_ITEMS) });
      },
    }),
    { name: "oristor-recently-viewed" },
  ),
);
