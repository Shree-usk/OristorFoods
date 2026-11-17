import type { Metadata } from "next";

import { ExportBuyerJourney } from "@/components/storefront/export/export-buyer-journey";
import { ExportCertificationStrip } from "@/components/storefront/export/export-certification-strip";
import { ExportCollectionsGrid } from "@/components/storefront/export/export-collections-grid";
import { ExportEnquiryForm } from "@/components/storefront/export/export-enquiry-form";
import { ExportPageHero } from "@/components/storefront/export/export-page-hero";
import { ExportProductCatalogue } from "@/components/storefront/export/export-product-catalogue";
import { ExportSolutionsGrid } from "@/components/storefront/export/export-solutions-grid";
import { Section } from "@/components/storefront/layout/section";
import { getExportCollectionsForStorefront } from "@/services/export-catalogue.service";
import {
  getCertificationStripForStorefront,
  getPageHeroForStorefront,
  getProcessStepsForStorefront,
  getSolutionCardsForStorefront,
} from "@/services/export-content.service";

export const metadata: Metadata = {
  title: "Export Solutions",
  description: "Partner with Oristor for global distribution — single-origin sourcing, bulk export packaging, and wholesale pricing for distributors, importers, and retailers worldwide.",
  alternates: { canonical: "/export" },
};

interface ExportPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ExportPage({ searchParams }: ExportPageProps) {
  const { collection } = await searchParams;
  const initialCollectionSlug = typeof collection === "string" ? collection : undefined;

  const [collections, hero, certificationStripItems, solutionCards, processSteps] = await Promise.all([
    getExportCollectionsForStorefront(),
    getPageHeroForStorefront(),
    getCertificationStripForStorefront(),
    getSolutionCardsForStorefront(),
    getProcessStepsForStorefront(),
  ]);
  const resolvedCollections = collections
    .filter((collection) => collection.image)
    .map((collection) => ({
      id: collection.id,
      name: collection.name,
      slug: collection.slug,
      image: collection.image!,
      description: collection.description,
    }));
  const collectionOptions = collections.map((collection) => ({ slug: collection.slug, name: collection.name }));

  return (
    <>
      <ExportPageHero data={hero} />
      <ExportCertificationStrip items={certificationStripItems} />
      <ExportSolutionsGrid cards={solutionCards} />
      <ExportBuyerJourney steps={processSteps} />

      {resolvedCollections.length > 0 ? (
        <Section spacing="sm">
          <ExportCollectionsGrid collections={resolvedCollections} />
        </Section>
      ) : null}

      <Section id="catalogue" spacing="sm">
        <ExportProductCatalogue collectionOptions={collectionOptions} initialCollectionSlug={initialCollectionSlug} />
      </Section>

      <Section id="enquiry">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-h2 font-heading text-charcoal text-center">Start an Enquiry</h2>
          <div className="mt-8">
            <ExportEnquiryForm />
          </div>
        </div>
      </Section>
    </>
  );
}
