// src/app/(storefront)/products/search/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { Section } from "@/components/storefront/layout/section";
import { ProductGrid } from "@/components/storefront/product/product-grid";
import { listBrands } from "@/repositories/brand.repository";
import { listAllergens, listCertifications } from "@/repositories/product.repository";
import { findDidYouMeanSuggestion, searchProducts } from "@/services/search.service";
import { productSearchQuerySchema } from "@/validation/product-search.schema";

interface ProductSearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ searchParams }: ProductSearchPageProps): Promise<Metadata> {
  const { q } = await searchParams.then((raw) => productSearchQuerySchema.parse(raw));
  return {
    title: q ? `Search results for "${q}"` : "Search Products",
    robots: { index: false, follow: true },
  };
}

export default async function ProductSearchPage({ searchParams }: ProductSearchPageProps) {
  const query = productSearchQuerySchema.parse(await searchParams);
  const { q, sort, page, pageSize } = query;

  const [result, allergens, certifications, brands] = await Promise.all([
    searchProducts(q, {
      sort,
      page,
      pageSize,
      filters: {
        priceMin: query.priceMin,
        priceMax: query.priceMax,
        allergens: query.allergens,
        certifications: query.certifications,
        brands: query.brands,
        inStock: query.inStock,
      },
    }),
    listAllergens(),
    listCertifications(),
    listBrands(),
  ]);

  const didYouMean = q && result.items.length === 0 ? await findDidYouMeanSuggestion(q) : null;

  return (
    <Section>
      <h1 className="text-h1 font-heading text-charcoal">{q ? `Results for "${q}"` : "Search Products"}</h1>

      {q && result.items.length === 0 ? (
        <div className="mt-8 text-body text-charcoal/70">
          {didYouMean ? (
            <p>
              No results found for &quot;{q}&quot;. Did you mean{" "}
              <Link
                href={`/products/search?q=${encodeURIComponent(didYouMean)}`}
                className="text-chilli hover:underline"
              >
                {didYouMean}
              </Link>
              ?
            </p>
          ) : (
            <p>No products match &quot;{q}&quot;.</p>
          )}
          <p className="mt-2">
            Browse{" "}
            <Link href="/products" className="text-chilli hover:underline">
              all products
            </Link>{" "}
            instead.
          </p>
        </div>
      ) : (
        <div className="mt-8">
          <ProductGrid
            scope={{ query: q }}
            initialData={result}
            allergenOptions={allergens.map((a) => ({ value: a.name, label: a.name }))}
            certificationOptions={certifications.map((c) => ({ value: c.id, label: c.name }))}
            brandOptions={brands.map((b) => ({ value: b.slug, label: b.name }))}
          />
        </div>
      )}
    </Section>
  );
}
