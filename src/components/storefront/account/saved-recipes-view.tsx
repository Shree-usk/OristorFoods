"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DashboardEmptyState } from "@/components/storefront/account/dashboard-empty-state";
import { RecipeGrid } from "@/components/storefront/recipes/recipe-grid";
import { fetchBookmarkedRecipes } from "@/lib/api/recipe-bookmark-client";
import { filterAndSortSavedRecipes, type SavedRecipesSort } from "@/lib/saved-recipes-filter";
import type { RecipeCard } from "@/types/recipe";

const SORT_LABELS: Record<SavedRecipesSort, string> = {
  dateSaved: "Date saved",
  alphabetical: "A–Z",
};

const PAGE_SIZE = 12;

/**
 * STORY-037. `useQuery` reads the same `["recipe-bookmarks"]` cache entry
 * RecipeBookmarkButton writes to everywhere else on the site (see
 * use-recipe-bookmark.ts) — hydrated from the server-rendered
 * `initialItems` so there's no empty-state flash on first load, and kept in
 * sync automatically: unsaving a card on this page (via RecipeCard's own
 * built-in bookmark button) updates the same cache every other bookmark
 * icon on the site reads from, with no bespoke removal code needed here.
 */
export function SavedRecipesView({ initialItems }: { initialItems: RecipeCard[] }) {
  const { data: items = [] } = useQuery({
    queryKey: ["recipe-bookmarks"],
    queryFn: fetchBookmarkedRecipes,
    initialData: initialItems,
  });

  const [category, setCategory] = useState<string | undefined>(undefined);
  const [sort, setSort] = useState<SavedRecipesSort>("dateSaved");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const categoryOptions = useMemo(() => [...new Set(items.map((item) => item.categoryName))].sort(), [items]);
  const filtered = useMemo(() => filterAndSortSavedRecipes(items, { category, sort }), [items, category, sort]);
  const visible = filtered.slice(0, visibleCount);

  if (items.length === 0) {
    return <DashboardEmptyState message="You haven't saved any recipes yet" ctaLabel="Browse Recipes" ctaHref="/recipes" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="saved-recipes-category">Category</Label>
          <Select
            value={category}
            onValueChange={(value) => {
              setCategory(value ?? undefined);
              setVisibleCount(PAGE_SIZE);
            }}
          >
            <SelectTrigger id="saved-recipes-category" aria-label="Filter by category">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              {categoryOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="saved-recipes-sort">Sort by</Label>
          <Select value={sort} onValueChange={(value) => setSort(value as SavedRecipesSort)}>
            <SelectTrigger id="saved-recipes-sort" aria-label="Sort by">
              <SelectValue>{(selected: SavedRecipesSort | null) => (selected ? SORT_LABELS[selected] : "Sort by")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(SORT_LABELS) as Array<[SavedRecipesSort, string]>).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-body text-charcoal/70">No saved recipes match this filter.</p>
      ) : (
        <>
          <RecipeGrid recipes={visible} />
          {visibleCount < filtered.length && (
            <Button variant="outline" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)} className="self-center">
              Show more
            </Button>
          )}
        </>
      )}
    </div>
  );
}
