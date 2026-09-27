import type { Metadata } from "next";

import { Section } from "@/components/storefront/layout/section";
import { DownloadCard } from "@/components/storefront/downloads/download-card";
import { DownloadCategoryFilter } from "@/components/storefront/downloads/download-category-filter";
import { listCategories, listResources } from "@/services/download.service";
import { downloadListQuerySchema } from "@/validation/download.schema";

export const metadata: Metadata = {
  title: "Downloads & Resources",
  description: "Printable recipe cards, nutrition guides, and ingredient resources from Oristor.",
  alternates: { canonical: "/downloads" },
};

interface DownloadsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DownloadsPage({ searchParams }: DownloadsPageProps) {
  const rawParams = await searchParams;
  const query = downloadListQuerySchema.parse({
    category: typeof rawParams.category === "string" ? rawParams.category : undefined,
    page: rawParams.page,
  });
  const [result, categories] = await Promise.all([listResources(query), listCategories()]);

  return (
    <Section>
      <h1 className="text-h1 font-heading text-charcoal">Downloads & Resources</h1>

      <DownloadCategoryFilter categories={categories} activeCategory={query.category} />

      <h2 id="downloads-results-heading" className="sr-only">
        Download results
      </h2>
      <p className="mt-6 text-small text-charcoal/70">
        {result.total} resource{result.total === 1 ? "" : "s"}
      </p>

      {result.items.length === 0 ? (
        <p className="mt-4 text-body text-charcoal/70">No resources match that filter.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3" aria-labelledby="downloads-results-heading">
          {result.items.map((resource) => (
            <DownloadCard key={resource.id} resource={resource} />
          ))}
        </div>
      )}
    </Section>
  );
}
