"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Pagination } from "@/components/storefront/listing/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { fetchExportCatalogueProducts } from "@/lib/api/export-catalogue-client";

import { ExportProductCard } from "./export-product-card";
import { ExportSelectionBar } from "./export-selection-bar";

const PAGE_SIZE = 24;
const SEARCH_DEBOUNCE_MS = 300;

export interface ExportCatalogueCollectionOption {
  slug: string;
  name: string;
}

interface ExportProductCatalogueProps {
  collectionOptions: ExportCatalogueCollectionOption[];
  initialCollectionSlug?: string;
}

export function ExportProductCatalogue({ collectionOptions, initialCollectionSlug }: ExportProductCatalogueProps) {
  const [search, setSearch] = useState("");
  const [collectionSlug, setCollectionSlug] = useState<string | undefined>(initialCollectionSlug);
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const query = useQuery({
    queryKey: ["export-catalogue-products", debouncedSearch, collectionSlug, page],
    queryFn: ({ signal }) => fetchExportCatalogueProducts({ search: debouncedSearch || undefined, collectionSlug, page, pageSize: PAGE_SIZE }, signal),
    placeholderData: keepPreviousData,
  });

  function clearFilters() {
    setSearch("");
    setCollectionSlug(undefined);
    setPage(1);
  }

  const data = query.data;

  return (
    <div>
      <h2 className="text-h2 font-heading text-charcoal">Product Catalogue</h2>
      <p className="mt-2 max-w-2xl text-body text-charcoal/80">
        Search our export-ready range and select the products you&apos;d like to include in your enquiry or download as a PDF catalogue.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Input
          type="search"
          value={search}
          maxLength={100}
          placeholder="Search by product name or SKU"
          aria-label="Search by product name or SKU"
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="h-10 w-full max-w-sm"
        />
        <Select
          value={collectionSlug ?? "all"}
          onValueChange={(value) => {
            setCollectionSlug(value && value !== "all" ? value : undefined);
            setPage(1);
          }}
        >
          <SelectTrigger aria-label="Filter by collection" className="w-56">
            <SelectValue>{(selected: string | null) => (selected && selected !== "all" ? collectionOptions.find((option) => option.slug === selected)?.name ?? "All collections" : "All collections")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All collections</SelectItem>
            {collectionOptions.map((option) => (
              <SelectItem key={option.slug} value={option.slug}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search || collectionSlug) && (
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      <div className="mt-6">
        {query.isPending ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-lg bg-charcoal/5" />
            ))}
          </div>
        ) : query.isError ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-small text-charcoal">
            <p>Couldn&apos;t load the catalogue.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
              Retry
            </Button>
          </div>
        ) : data && data.items.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {data.items.map((product) => (
                <ExportProductCard key={product.id} product={product} />
              ))}
            </div>
            {data.total > PAGE_SIZE && <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={setPage} />}
          </>
        ) : (
          <div className="rounded-lg border border-charcoal/10 bg-ivory p-8 text-center">
            <p className="text-body text-charcoal/70">No products match those filters.</p>
            {(search || collectionSlug) && (
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        )}
      </div>

      <ExportSelectionBar />
    </div>
  );
}
