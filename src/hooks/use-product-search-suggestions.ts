"use client";

import { useQuery } from "@tanstack/react-query";

import type { SearchSuggestion } from "@/services/search.service";

export function useProductSearchSuggestions(query: string) {
  return useQuery({
    queryKey: ["product-search-suggestions", query],
    queryFn: async () => {
      const response = await fetch(`/api/products/search/suggestions?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error("Failed to load product search suggestions");
      return (await response.json()) as SearchSuggestion[];
    },
    enabled: query.length > 0,
  });
}
