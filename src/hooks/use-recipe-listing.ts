"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { RecipeListingParams } from "@/hooks/use-recipe-listing-params";
import type { RecipeListResult } from "@/types/recipe";

const SEARCH_DEBOUNCE_MS = 300;

/** Query string for GET /api/recipes. The server re-validates everything. */
export function buildRecipeApiSearch(params: RecipeListingParams, pageSize: number): string {
  const search = new URLSearchParams();
  if (params.category) search.set("category", params.category);
  if (params.difficulty && params.difficulty.length > 0) search.set("difficulty", params.difficulty.join(","));
  if (params.time && params.time.length > 0) search.set("time", params.time.join(","));
  if (params.diet && params.diet.length > 0) search.set("diet", params.diet.join(","));
  const q = params.q?.trim();
  if (q) search.set("q", q);
  search.set("sort", params.sort);
  search.set("page", String(params.page));
  search.set("pageSize", String(pageSize));
  return search.toString();
}

/**
 * Fetches the listing for the current URL state. The search text is
 * debounced here (not in the input), so the URL and the box stay in sync
 * with Back/Forward while typing doesn't fire a request per keystroke.
 *
 * `result` is never empty-handed: while a new request is in flight it's the
 * previous results (keepPreviousData), and if that request fails it stays
 * the last successful result, so the page never shows an unfiltered list
 * under a filter the customer just picked. `isError` drives the retry alert.
 */
export function useRecipeListing(params: RecipeListingParams, initialData: RecipeListResult) {
  const pageSize = initialData.pageSize;
  const debouncedQ = useDebouncedValue(params.q, SEARCH_DEBOUNCE_MS);
  const search = buildRecipeApiSearch({ ...params, q: debouncedQ }, pageSize);

  // Same idea as useProductListing: the server's data seeds only the
  // request it was rendered for, never a later filter change.
  const initialSearch = useRef(search).current;

  const query = useQuery({
    queryKey: ["recipes", search],
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/recipes?${search}`, { signal });
      if (!response.ok) throw new Error("Failed to load recipes");
      return (await response.json()) as RecipeListResult;
    },
    initialData: () => (search === initialSearch ? initialData : undefined),
    placeholderData: keepPreviousData,
    // Without this, TanStack Query treats server-supplied `initialData` as
    // stale immediately (staleTime defaults to 0) and fires a background
    // refetch on mount even though nothing has changed — clobbering the
    // just-rendered result with whatever a same-tick network response
    // returns. Same value as review-list.tsx / qa-list.tsx.
    staleTime: 60_000,
  });

  // Keep the last successful result for the error state. Adjusting state
  // during render (not in an effect) is React's documented pattern for this.
  const [lastResult, setLastResult] = useState(initialData);
  if (query.data && query.data !== lastResult) {
    setLastResult(query.data);
  }

  return {
    result: query.data ?? lastResult,
    isError: query.isError,
    isFetching: query.isFetching,
    retry: () => void query.refetch(),
  };
}
