import { create } from "zustand";
import { persist } from "zustand/middleware";

const MAX_QUERIES = 5;

interface RecentSearchesState {
  queries: string[];
  add: (query: string) => void;
}

/**
 * Client-side recent-search history for the Global Search overlay
 * (STORY-007). Persisted to localStorage — same count-or-list-in-
 * localStorage pattern as recently-viewed-store.ts (STORY-011); extend
 * that convention rather than introducing a different one.
 */
export const useRecentSearchesStore = create<RecentSearchesState>()(
  persist(
    (set, get) => ({
      queries: [],
      add: (query) => {
        const deduped = get().queries.filter(
          (existing) => existing.toLowerCase() !== query.toLowerCase(),
        );
        set({ queries: [query, ...deduped].slice(0, MAX_QUERIES) });
      },
    }),
    { name: "oristor-recent-searches" },
  ),
);
