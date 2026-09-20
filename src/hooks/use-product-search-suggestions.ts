"use client";

import { useQuery } from "@tanstack/react-query";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { SearchSuggestion } from "@/services/search.service";

// Matches search-overlay.tsx's existing debounce interval for its sibling
// suggestions hook (use-search-suggestions.ts) — kept in sync deliberately
// so both search surfaces feel identical, even though this hook (built
// ahead of a future header-overlay caller) debounces internally rather than
// relying on its caller to pre-debounce.
const DEBOUNCE_MS = 275;

export function useProductSearchSuggestions(query: string) {
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);

  return useQuery({
    queryKey: ["product-search-suggestions", debouncedQuery],
    queryFn: async () => {
      const response = await fetch(`/api/products/search/suggestions?q=${encodeURIComponent(debouncedQuery)}`);
      if (!response.ok) throw new Error("Failed to load product search suggestions");
      return (await response.json()) as SearchSuggestion[];
    },
    enabled: debouncedQuery.length > 0,
  });
}
