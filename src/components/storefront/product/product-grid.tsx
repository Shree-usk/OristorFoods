"use client";

import { useProductListingParams } from "@/hooks/use-product-listing-params";
import { useProductListing, type ProductListingScope } from "@/hooks/use-product-listing";
import type { ProductListingResult, ProductSort } from "@/services/product.service";
import type { FilterOptionGroup, FilterValues } from "./filter-controls";
import { FilterSidebar } from "./filter-sidebar";
import { FilterDrawer } from "./filter-drawer";
import { SortSelect } from "./sort-select";
import { ProductCard } from "./product-card";
import { Pagination } from "./pagination";

interface ProductGridProps {
  scope: ProductListingScope;
  initialData: ProductListingResult;
  allergenOptions: FilterOptionGroup["options"];
  certificationOptions: FilterOptionGroup["options"];
  brandOptions: FilterOptionGroup["options"];
}

export function ProductGrid({
  scope,
  initialData,
  allergenOptions,
  certificationOptions,
  brandOptions,
}: ProductGridProps) {
  const [params, setParams] = useProductListingParams();
  const { data, isLoading } = useProductListing(scope, params, initialData);

  const filterValues: FilterValues = {
    priceMin: params.priceMin ?? undefined,
    priceMax: params.priceMax ?? undefined,
    allergens: params.allergens ?? [],
    certifications: params.certifications ?? [],
    brands: params.brands ?? [],
    inStock: params.inStock ?? false,
  };

  function handleFilterChange(next: FilterValues) {
    void setParams({
      page: 1,
      priceMin: next.priceMin ?? null,
      priceMax: next.priceMax ?? null,
      allergens: next.allergens.length > 0 ? next.allergens : null,
      certifications: next.certifications.length > 0 ? next.certifications : null,
      brands: next.brands.length > 0 ? next.brands : null,
      inStock: next.inStock ? true : null,
    });
  }

  function clearFilters() {
    void setParams({
      page: 1,
      priceMin: null,
      priceMax: null,
      allergens: null,
      certifications: null,
      brands: null,
      inStock: null,
    });
  }

  const filterProps = {
    values: filterValues,
    onChange: handleFilterChange,
    allergenOptions,
    certificationOptions,
    brandOptions,
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <FilterSidebar {...filterProps} />
      <div className="flex-1">
        <div className="mb-4 flex items-center justify-between gap-4">
          <FilterDrawer {...filterProps} />
          <SortSelect
            value={params.sort}
            onValueChange={(sort: ProductSort) => void setParams({ sort, page: 1 })}
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: initialData.pageSize }, (_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <p className="text-body text-charcoal">No products match your filters.</p>
            <button
              type="button"
              onClick={clearFilters}
              className="text-small text-chilli hover:underline"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {data.items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onPageChange={(page) => void setParams({ page })}
            />
          </>
        )}
      </div>
    </div>
  );
}
