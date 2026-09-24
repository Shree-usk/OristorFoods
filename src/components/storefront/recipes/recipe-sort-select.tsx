"use client";

import { SortSelect, type SortOption } from "@/components/storefront/listing/sort-select";
import { recipeSortLabels, recipeSortValues, type RecipeSort } from "@/lib/recipe-listing-values";

const options: SortOption<RecipeSort>[] = recipeSortValues.map((sort) => ({ value: sort, label: recipeSortLabels[sort] }));

interface RecipeSortSelectProps {
  value: RecipeSort;
  onValueChange: (value: RecipeSort) => void;
}

export function RecipeSortSelect({ value, onValueChange }: RecipeSortSelectProps) {
  return <SortSelect value={value} options={options} onValueChange={onValueChange} ariaLabel="Sort recipes" />;
}
