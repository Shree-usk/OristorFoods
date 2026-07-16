import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Section } from "@/components/storefront/layout/section";
import { ProductGrid } from "@/components/storefront/product/product-grid";
import { loadProductListingParams } from "@/lib/product-listing-loader";
import { listBrands } from "@/repositories/brand.repository";
import { findCategoryBySlug } from "@/repositories/category.repository";
import { listAllergens, listCertifications } from "@/repositories/product.repository";
import { listProducts } from "@/services/product.service";
import { productListingQuerySchema } from "@/validation/product-listing.schema";

interface CategoryPageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category: categorySlug } = await params;
  const category = await findCategoryBySlug(categorySlug);
  if (!category) return {};

  return {
    title: category.metaTitle ?? category.name,
    description: category.metaDescription ?? category.description ?? undefined,
    alternates: category.canonicalUrl ? { canonical: category.canonicalUrl } : undefined,
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { category: categorySlug } = await params;
  const category = await findCategoryBySlug(categorySlug);
  if (!category) notFound();

  const listingParams = await loadProductListingParams(searchParams);
  const { pageSize } = productListingQuerySchema.pick({ pageSize: true }).parse(await searchParams);

  const [result, allergens, certifications, brands] = await Promise.all([
    listProducts({
      categorySlug,
      sort: listingParams.sort,
      page: listingParams.page,
      pageSize,
      filters: {
        priceMin: listingParams.priceMin ?? undefined,
        priceMax: listingParams.priceMax ?? undefined,
        allergens: listingParams.allergens ?? undefined,
        certifications: listingParams.certifications ?? undefined,
        brands: listingParams.brands ?? undefined,
        inStock: listingParams.inStock ?? undefined,
      },
    }),
    listAllergens(),
    listCertifications(),
    listBrands(),
  ]);

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: result.items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: item.href,
      name: item.name,
    })),
  };

  return (
    <Section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <h1 className="text-h1 font-heading text-charcoal">{category.name}</h1>
      <div className="mt-8">
        <ProductGrid
          scope={{ category: categorySlug }}
          initialData={result}
          allergenOptions={allergens.map((a) => ({ value: a.name, label: a.name }))}
          certificationOptions={certifications.map((c) => ({ value: c.id, label: c.name }))}
          brandOptions={brands.map((b) => ({ value: b.slug, label: b.name }))}
        />
      </div>
    </Section>
  );
}
