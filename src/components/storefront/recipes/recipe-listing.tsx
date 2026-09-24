"use client";

import { useState } from "react";

import { FilterDrawer } from "@/components/storefront/listing/filter-drawer";
import { FilterSidebar } from "@/components/storefront/listing/filter-sidebar";
import { Pagination } from "@/components/storefront/listing/pagination";
import { Button } from "@/components/ui/button";
import { useRecipeListing } from "@/hooks/use-recipe-listing";
import { useRecipeListingParams } from "@/hooks/use-recipe-listing-params";
import { serializeRecipeListing } from "@/lib/recipe-listing-params";
import { cn } from "@/lib/utils";
import type { RecipeFacets, RecipeListResult } from "@/types/recipe";
import { RecipeCategoryChips } from "./recipe-category-chips";
import { RecipeEmptyState } from "./recipe-empty-state";
import { RecipeFilterControls, type RecipeFilterValues } from "./recipe-filter-controls";
import { RecipeGrid } from "./recipe-grid";
import { RecipeSearchBox } from "./recipe-search-box";
import { RecipeSortSelect } from "./recipe-sort-select";

interface RecipeListingProps {
  initialData: RecipeListResult;
  facets: RecipeFacets;
}

function countLabel(total: number) {
  return `${total} ${total === 1 ? "recipe" : "recipes"}`;
}

export function RecipeListing({ initialData, facets }: RecipeListingProps) {
  const [params, setParams] = useRecipeListingParams();
  const { result, isError, isFetching, retry } = useRecipeListing(params, initialData);

  // Bound to local state, not `params.q` directly: nuqs syncs the URL
  // asynchronously, and a controlled input reading that async value can
  // revert mid-keystroke and drop characters during fast typing. Same
  // approach as search-overlay.tsx's `rawQuery`.
  const [searchInput, setSearchInput] = useState(params.q ?? "");

  const filterValues: RecipeFilterValues = {
    difficulty: params.difficulty ?? [],
    time: params.time ?? [],
    diet: params.diet ?? [],
  };

  function handleFilterChange(next: RecipeFilterValues) {
    void setParams({
      page: null,
      difficulty: next.difficulty.length > 0 ? next.difficulty : null,
      time: next.time.length > 0 ? next.time : null,
      diet: next.diet.length > 0 ? next.diet : null,
    });
  }

  function clearFilters() {
    setSearchInput("");
    void setParams({ page: null, category: null, difficulty: null, time: null, diet: null, q: null });
  }

  const filters = (
    <RecipeFilterControls
      values={filterValues}
      onChange={handleFilterChange}
      dietaryTagOptions={facets.dietaryTags}
      onClear={clearFilters}
    />
  );

  const pageCount = Math.ceil(result.total / result.pageSize);

  return (
    <div className="flex flex-col gap-6">
      <RecipeSearchBox
        value={searchInput}
        onChange={(q) => {
          setSearchInput(q);
          void setParams({ q: q === "" ? null : q, page: null }, { history: "replace" });
        }}
      />
      <RecipeCategoryChips
        categories={facets.categories}
        selected={params.category}
        hrefFor={(slug) => serializeRecipeListing("/recipes", { ...params, category: slug, page: null })}
        onSelect={(slug) => void setParams({ category: slug, page: null })}
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <FilterSidebar label="Filter recipes">{filters}</FilterSidebar>

        <section aria-labelledby="recipe-results-heading" className="min-w-0 flex-1">
          <h2 id="recipe-results-heading" className="sr-only">
            Recipe results
          </h2>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <p aria-live="polite" className="text-small text-charcoal/70">
              {countLabel(result.total)}
            </p>
            <div className="flex items-center gap-2">
              <FilterDrawer>{filters}</FilterDrawer>
              <RecipeSortSelect value={params.sort} onValueChange={(sort) => void setParams({ sort, page: null })} />
            </div>
          </div>

          {isError && (
            <div
              role="alert"
              className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-small text-charcoal"
            >
              <p>Couldn&apos;t update recipes.</p>
              <Button type="button" variant="outline" size="sm" onClick={retry}>
                Retry
              </Button>
            </div>
          )}

          <div aria-busy={isFetching} className={cn("transition-opacity", isFetching && "opacity-60")}>
            {result.recipes.length > 0 ? (
              <>
                <RecipeGrid recipes={result.recipes} />
                {pageCount > 1 && (
                  <Pagination
                    page={result.page}
                    pageSize={result.pageSize}
                    total={result.total}
                    onPageChange={(page) => void setParams({ page })}
                  />
                )}
              </>
            ) : result.total === 0 ? (
              <RecipeEmptyState message="No recipes match those filters." actionLabel="Clear all filters" onAction={clearFilters} />
            ) : (
              <RecipeEmptyState
                message="There are no recipes on this page."
                actionLabel="Go to first page"
                onAction={() => void setParams({ page: null })}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
