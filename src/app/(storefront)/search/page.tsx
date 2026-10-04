// src/app/(storefront)/search/page.tsx
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Section } from "@/components/storefront/layout/section";
import { ProductCard } from "@/components/storefront/product/product-card";
import { SearchInput } from "@/components/storefront/search/search-input";
import { getSmartSearchResults } from "@/services/smart-search.service";
import type { SearchSuggestionItem } from "@/services/search-extensions";
import { auth } from "@/lib/auth";
import { resolveCustomerGroupForUser } from "@/services/pricing.service";
import { searchQuerySchema } from "@/validation/search.schema";

interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const { q } = searchQuerySchema.parse(await searchParams);
  return {
    title: q ? `Search results for "${q}"` : "Search",
    // An internal site-search results page with a user-input-reflected
    // <title> is a crawl-budget/thin-content problem — keep it out of the
    // index, but its own links to products/recipes are still fine to
    // follow.
    robots: { index: false, follow: true },
  };
}

function ContentResultCard({ item }: { item: SearchSuggestionItem }) {
  return (
    <Link href={item.href} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-cream">
        {item.imageSrc && (
          <Image
            src={item.imageSrc}
            alt=""
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform group-hover:scale-105"
          />
        )}
      </div>
      <p className="mt-3 text-small font-medium text-charcoal">{item.label}</p>
    </Link>
  );
}

function ContentResultGroup({ title, items }: { title: string; items: SearchSuggestionItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-10">
      <h2 className="text-h3 font-heading text-charcoal">{title}</h2>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <ContentResultCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

/**
 * STORY-061. AI Smart Search's unified results page — products,
 * recipes, blog posts, and Food Academy entries grouped by type, from
 * a single semantic-blended query. No "degraded mode" indicator is
 * shown when the semantic layer didn't run (AC #7's "transparently");
 * the keyword-matched results are the same either way. Unlike the
 * prior products-only version, results are a fixed top-N per
 * category rather than paginated — a flat page number doesn't map
 * cleanly onto four independently-ranked groups.
 */
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = searchQuerySchema.parse(await searchParams);
  const session = await auth();
  const customerGroup = await resolveCustomerGroupForUser(session?.user?.id ?? null);
  const results = await getSmartSearchResults(q, { customerGroup, customerId: session?.user?.id ?? null });

  const totalResults = results.products.length + results.recipes.length + results.blogPosts.length + results.foodAcademyEntries.length;

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
          {totalResults} result{totalResults === 1 ? "" : "s"}
        </div>
      )}

      {q && totalResults === 0 ? (
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
        <>
          {results.products.length > 0 && (
            <div className="mt-10">
              <h2 className="text-h3 font-heading text-charcoal">Products</h2>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {results.products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </div>
          )}
          <ContentResultGroup title="Recipes" items={results.recipes} />
          <ContentResultGroup title="Blog" items={results.blogPosts} />
          <ContentResultGroup title="Food Academy" items={results.foodAcademyEntries} />
        </>
      )}
    </Section>
  );
}
