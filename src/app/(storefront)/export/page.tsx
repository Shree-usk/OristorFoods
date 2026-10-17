import type { Metadata } from "next";

import { ExportBuyerJourney } from "@/components/storefront/export/export-buyer-journey";
import { ExportCollectionsGrid } from "@/components/storefront/export/export-collections-grid";
import { ExportEnquiryForm } from "@/components/storefront/export/export-enquiry-form";
import { ExportProductCatalogue } from "@/components/storefront/export/export-product-catalogue";
import { Section } from "@/components/storefront/layout/section";
import { getExportCollectionsForStorefront } from "@/services/export-catalogue.service";

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

  const collections = await getExportCollectionsForStorefront();
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
      <Section>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-small font-medium tracking-wide text-chilli uppercase">Export Solutions</p>
          <h1 className="mt-2 text-h1 font-heading text-charcoal">Partner with Oristor for Global Distribution</h1>
          <p className="mt-4 text-body text-charcoal/80">
            From single-origin sourcing to bulk export packaging, we work with distributors, importers, and retailers
            worldwide to bring authentic Sri Lankan food products to new markets. Browse our collections, select the
            products you&apos;re interested in, and our export team will follow up with pricing and availability.
          </p>
        </div>
      </Section>

      {resolvedCollections.length > 0 ? (
        <Section spacing="sm">
          <ExportCollectionsGrid collections={resolvedCollections} />
        </Section>
      ) : null}

      <Section spacing="sm">
        <ExportBuyerJourney />
      </Section>

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
