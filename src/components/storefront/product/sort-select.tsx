"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProductSort } from "@/services/product.service";

const sortLabels: Record<ProductSort, string> = {
  relevance: "Relevance",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
  newest: "Newest",
  "best-selling": "Best Selling",
  rating: "Average Rating",
};

// No sales data yet (Commerce Platform epic) for "best-selling". "rating"
// could now read ProductRatingSummary (STORY-015), but the listing query
// doesn't support it yet — both stay disabled until they're built.
const disabledSorts: ProductSort[] = ["best-selling", "rating"];

// "Relevance" only means something with a search query behind it (STORY-012)
// — every other listing page (category/collection browsing) defaults to
// "newest" and would show a confusing, non-functional option otherwise.
const baseSorts = (Object.keys(sortLabels) as ProductSort[]).filter((sort) => sort !== "relevance");

interface SortSelectProps {
  value: ProductSort;
  onValueChange: (value: ProductSort) => void;
  showRelevance?: boolean;
}

export function SortSelect({ value, onValueChange, showRelevance = false }: SortSelectProps) {
  const allSorts = showRelevance ? (["relevance", ...baseSorts] as ProductSort[]) : baseSorts;

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
