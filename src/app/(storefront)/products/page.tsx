import type { Metadata } from "next";

import { Section } from "@/components/storefront/layout/section";
import { ProductGrid } from "@/components/storefront/product/product-grid";
import { loadProductListingParams } from "@/lib/product-listing-loader";
import { listBrands } from "@/repositories/brand.repository";
import { listAllergens, listCertifications } from "@/repositories/product.repository";
import { listProducts } from "@/services/product.service";

export const metadata: Metadata = {
  title: "All Products",
  description: "Browse the full Oristor product catalogue.",
};

interface ProductsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await loadProductListingParams(searchParams);

  const [result, allergens, certifications, brands] = await Promise.all([
    listProducts({
      sort: params.sort,
      page: params.page,
      filters: {
        priceMin: params.priceMin ?? undefined,
        priceMax: params.priceMax ?? undefined,
        allergens: params.allergens ?? undefined,
        certifications: params.certifications ?? undefined,
        brands: params.brands ?? undefined,
        inStock: params.inStock ?? undefined,
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
      <h1 className="text-h1 font-heading text-charcoal">All Products</h1>
      <div className="mt-8">
        <ProductGrid
          scope={{}}
          initialData={result}
          allergenOptions={allergens.map((a) => ({ value: a.name, label: a.name }))}
          certificationOptions={certifications.map((c) => ({ value: c.id, label: c.name }))}
          brandOptions={brands.map((b) => ({ value: b.slug, label: b.name }))}
        />
      </div>
    </Section>
  );
}
