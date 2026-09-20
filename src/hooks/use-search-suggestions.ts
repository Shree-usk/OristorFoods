"use client";

import { useQuery } from "@tanstack/react-query";

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
  });
}
