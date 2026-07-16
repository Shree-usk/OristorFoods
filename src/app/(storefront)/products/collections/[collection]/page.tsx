import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Section } from "@/components/storefront/layout/section";
import { ProductGrid } from "@/components/storefront/product/product-grid";
import { loadProductListingParams } from "@/lib/product-listing-loader";
import { listBrands } from "@/repositories/brand.repository";
import { listAllergens, listCertifications } from "@/repositories/product.repository";
import { getPublishedCollectionBySlug } from "@/services/collection.service";
import { listProducts } from "@/services/product.service";

interface CollectionPageProps {
  params: Promise<{ collection: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const { collection: collectionSlug } = await params;
  const collection = await getPublishedCollectionBySlug(collectionSlug);
  if (!collection) return {};

  return {
    title: collection.metaTitle ?? collection.name,
    description: collection.metaDescription ?? collection.description ?? undefined,
    alternates: collection.canonicalUrl ? { canonical: collection.canonicalUrl } : undefined,
  };
}

export default async function CollectionPage({ params, searchParams }: CollectionPageProps) {
  const { collection: collectionSlug } = await params;
  const collection = await getPublishedCollectionBySlug(collectionSlug);
  if (!collection) notFound();

  const listingParams = await loadProductListingParams(searchParams);

  const [result, allergens, certifications, brands] = await Promise.all([
    listProducts({
      collectionSlug,
      sort: listingParams.sort,
      page: listingParams.page,
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
      <h1 className="text-h1 font-heading text-charcoal">{collection.name}</h1>
      <div className="mt-8">
        <ProductGrid
          scope={{ collection: collectionSlug }}
          initialData={result}
          allergenOptions={allergens.map((a) => ({ value: a.name, label: a.name }))}
          certificationOptions={certifications.map((c) => ({ value: c.id, label: c.name }))}
          brandOptions={brands.map((b) => ({ value: b.slug, label: b.name }))}
        />
      </div>
    </Section>
  );
}
