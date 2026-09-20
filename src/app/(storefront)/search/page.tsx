// src/app/(storefront)/search/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { Section } from "@/components/storefront/layout/section";
import { ProductCard } from "@/components/storefront/product/product-card";
import { SearchInput } from "@/components/storefront/search/search-input";
import { searchCatalogue } from "@/services/search.service";
import { searchQuerySchema } from "@/validation/search.schema";

interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const { q } = searchQuerySchema.parse(await searchParams);
  return { title: q ? `Search results for "${q}"` : "Search" };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q, page } = searchQuerySchema.parse(await searchParams);
  const results = await searchCatalogue(q, { page });

  return (
    <Section>
      <form role="search" aria-label="Site" action="/search" method="get" className="flex gap-2">
        <SearchInput id="search-page-input" name="q" defaultValue={q} />
        <button
          type="submit"
          className="h-11 shrink-0 rounded-lg bg-primary px-4 text-small font-medium text-primary-foreground hover:bg-primary/80"
        >
          Search
        </button>
      </form>

      <h1 className="mt-8 text-h1 font-heading text-charcoal">{q ? `Results for "${q}"` : "Search"}</h1>

      {q && (
        <div aria-live="polite" className="mt-1 text-small text-charcoal/70">
          {results.products.length} result{results.products.length === 1 ? "" : "s"}
        </div>
      )}

      {q && results.products.length === 0 ? (
        <div className="mt-8 text-body text-charcoal/70">
          <p>No results found for &quot;{q}&quot;.</p>
          <p className="mt-2">
            Browse{" "}
            <Link href="/products" className="text-chilli hover:underline">
              all products
            </Link>{" "}
            or{" "}
            <Link href="/recipes" className="text-chilli hover:underline">
              recipes
            </Link>{" "}
            instead.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {results.products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {results.hasNextPage && (
        <div className="mt-8 flex justify-center">
          <Link
            href={`/search?q=${encodeURIComponent(q)}&page=${page + 1}`}
            className="text-small text-chilli hover:underline"
          >
            Load more results
          </Link>
        </div>
      )}
    </Section>
  );
}
