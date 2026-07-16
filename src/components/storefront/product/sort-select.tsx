"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProductSort } from "@/services/product.service";

const sortLabels: Record<ProductSort, string> = {
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
  newest: "Newest",
  "best-selling": "Best Selling",
  rating: "Average Rating",
};

// STORY-015 (Reviews) and the Commerce Platform epic haven't landed yet, so
// there's no real data to sort "best-selling"/"rating" by — disabled for
// now, see docs/superpowers/specs/2026-07-16-product-listing-design.md.
const disabledSorts: ProductSort[] = ["best-selling", "rating"];
const allSorts = Object.keys(sortLabels) as ProductSort[];

interface SortSelectProps {
  value: ProductSort;
  onValueChange: (value: ProductSort) => void;
}

export function SortSelect({ value, onValueChange }: SortSelectProps) {
  return (
    <Select value={value} onValueChange={(next) => onValueChange(next as ProductSort)}>
      <SelectTrigger aria-label="Sort products">
        <SelectValue placeholder="Sort by">
          {(selected: ProductSort | null) => (selected ? sortLabels[selected] : "Sort by")}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allSorts.map((sort) => (
          <SelectItem key={sort} value={sort} disabled={disabledSorts.includes(sort)}>
            {disabledSorts.includes(sort) ? `${sortLabels[sort]} (coming soon)` : sortLabels[sort]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
