import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { Breadcrumbs } from "@/components/storefront/layout/breadcrumbs";
import { Section } from "@/components/storefront/layout/section";
import { CertificationBadges } from "@/components/storefront/product/certification-badges";
import { IngredientsList } from "@/components/storefront/product/ingredients-list";
import { NutritionDisclosure } from "@/components/storefront/product/nutrition-disclosure";
import { ExportProductGallery } from "@/components/storefront/export/export-product-gallery";
import { ExportProductSelectionAction } from "@/components/storefront/export/export-product-selection-action";
import { getExportCatalogueProductDetail } from "@/services/export-catalogue.service";

const getCachedExportCatalogueProductDetail = cache(getExportCatalogueProductDetail);

function formatPackSize(weightGrams: number | null): string | null {
  if (!weightGrams) return null;
  return weightGrams >= 1000 ? `${(weightGrams / 1000).toFixed(weightGrams % 1000 === 0 ? 0 : 1)}kg` : `${weightGrams}g`;
}

interface ExportCatalogueProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ExportCatalogueProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getCachedExportCatalogueProductDetail(slug);
  if (!product) return {};

  return {
    title: `${product.name} — Export Catalogue`,
    description: product.exportDescription ?? product.shortDescription ?? undefined,
    alternates: { canonical: `/export/catalogue/${product.slug}` },
  };
}

export default async function ExportCatalogueProductPage({ params }: ExportCatalogueProductPageProps) {
  const { slug } = await params;
  const product = await getCachedExportCatalogueProductDetail(slug);
  if (!product) notFound();

  const description = product.exportDescription ?? product.shortDescription;
  const packSize = formatPackSize(product.weightGrams);
  const tags = [...product.categories, ...product.collections];

  return (
    <Section>
      <Breadcrumbs items={[{ name: "Export Catalogue", href: "/export#catalogue" }, { name: product.name, href: `/export/catalogue/${product.slug}` }]} />

      <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-2">
        <ExportProductGallery images={product.images} productName={product.name} />

        <div>
          {product.isExportFeatured ? (
            <span className="inline-block rounded-full bg-chilli px-2 py-0.5 text-xs font-medium text-ivory">Featured</span>
          ) : null}
          <h1 className="mt-2 text-h1 font-heading text-charcoal">{product.name}</h1>
          <p className="mt-1 text-small text-charcoal/60">
            SKU {product.sku}
            {packSize ? ` · ${packSize}` : ""}
          </p>

          {tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span key={tag.id} className="rounded-full bg-charcoal/5 px-2 py-0.5 text-xs text-charcoal/70">
                  {tag.name}
                </span>
              ))}
            </div>
          ) : null}

          {description ? <p className="mt-4 text-body text-charcoal">{description}</p> : null}

          <div className="mt-6">
            <ExportProductSelectionAction product={{ id: product.id, name: product.name, sku: product.sku }} />
          </div>

          {product.ingredients.length > 0 ? (
            <div className="mt-6">
              <h2 className="text-h4 font-heading text-charcoal">Ingredients</h2>
              <div className="mt-2">
                <IngredientsList ingredients={product.ingredients} />
              </div>
            </div>
          ) : null}

          <CertificationBadges allergens={product.allergens} certifications={product.certifications} />

          {product.nutrition ? (
            <div className="mt-6">
              <NutritionDisclosure nutrition={product.nutrition} />
            </div>
          ) : null}
        </div>
      </div>
    </Section>
  );
}
