"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { SearchResultsPage } from "@/services/search.service";

const SUGGESTIONS_PAGE_SIZE = 5;

export function useSearchSuggestions(query: string) {
  return useQuery({
    queryKey: ["search-suggestions", query],
    queryFn: async () => {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(query)}&pageSize=${SUGGESTIONS_PAGE_SIZE}`,
      );
      if (!response.ok) throw new Error("Failed to load search suggestions");
      return (await response.json()) as SearchResultsPage;
    },
    enabled: query.length > 0,
    // Keep the previous keystroke's results on screen while the new
    // debounced query is in flight, instead of falling back to `undefined`
    // — otherwise every keystroke briefly renders "No matches yet" and the
    // aria-live region announces a false "0 results found" before the real
    // results arrive.
    placeholderData: keepPreviousData,
  });
}
