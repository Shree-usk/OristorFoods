"use client";

import { SortSelect, type SortOption } from "@/components/storefront/listing/sort-select";
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

interface ProductSortSelectProps {
  value: ProductSort;
  onValueChange: (value: ProductSort) => void;
  showRelevance?: boolean;
}

export function ProductSortSelect({ value, onValueChange, showRelevance = false }: ProductSortSelectProps) {
  const sorts: ProductSort[] = showRelevance ? ["relevance", ...baseSorts] : baseSorts;
  const options: SortOption<ProductSort>[] = sorts.map((sort) => ({
    value: sort,
    label: sortLabels[sort],
    disabled: disabledSorts.includes(sort),
  }));

  return <SortSelect value={value} options={options} onValueChange={onValueChange} ariaLabel="Sort products" />;
}
