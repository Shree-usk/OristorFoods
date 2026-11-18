import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Section } from "@/components/storefront/layout/section";
import { FoodAcademyCard } from "@/components/storefront/food-academy/food-academy-card";
import { FoodAcademyCategoryTiles } from "@/components/storefront/food-academy/food-academy-category-tiles";
import { FoodAcademyFeaturedSection } from "@/components/storefront/food-academy/food-academy-featured-section";
import { FoodAcademyHero } from "@/components/storefront/food-academy/food-academy-hero";
import { FoodAcademyPageJsonLd } from "@/components/storefront/food-academy/food-academy-page-json-ld";
import { ItemListJsonLd } from "@/components/storefront/product/item-list-json-ld";
import { cn } from "@/lib/utils";
import { listCategories, listEntries, listFeaturedEntries } from "@/services/food-academy.service";
import { getFoodAcademyPageSettingForStorefront } from "@/services/food-academy-page-setting.service";
import { foodAcademyListQuerySchema } from "@/validation/food-academy.schema";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getFoodAcademyPageSettingForStorefront();
  return {
    title: settings.seoTitle,
    description: settings.seoMetaDescription,
    alternates: { canonical: settings.seoCanonicalPath },
    openGraph: {
      title: settings.seoTitle,
      description: settings.seoMetaDescription,
      ...(settings.seoOgImageUrl ? { images: [{ url: settings.seoOgImageUrl }] } : {}),
    },
  };
}

const CONTENT_TYPES = ["Article", "Guide", "Course"] as const;

interface FoodAcademyPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function FoodAcademyPage({ searchParams }: FoodAcademyPageProps) {
  const rawParams = await searchParams;
  const query = foodAcademyListQuerySchema.parse({
    category: typeof rawParams.category === "string" ? rawParams.category : undefined,
    contentType: typeof rawParams.contentType === "string" ? rawParams.contentType : undefined,
    page: rawParams.page,
  });

  const [settings, result, categories, featured] = await Promise.all([
    getFoodAcademyPageSettingForStorefront(),
    listEntries(query),
    listCategories(),
    query.category || query.contentType ? Promise.resolve([]) : listFeaturedEntries(),
  ]);

  if (!settings.enabled) notFound();

  const hasActiveFilter = Boolean(query.category || query.contentType);

  return (
    <>
      <FoodAcademyHero data={settings} />

      {!hasActiveFilter && (
        <FoodAcademyCategoryTiles heading={settings.exploreHeading} description={settings.exploreDescription} categories={categories} />
      )}

      {!hasActiveFilter && (
        <FoodAcademyFeaturedSection heading={settings.featuredHeading} description={settings.featuredDescription} entries={featured} />
      )}

      <Section>
        <nav aria-label="Filter by category" className="flex flex-wrap gap-2">
          <Link
            href="/food-academy"
            aria-current={!query.category ? "page" : undefined}
            className={cn("rounded-full border px-4 py-1.5 text-small", !query.category ? "border-chilli bg-chilli text-white" : "border-input")}
          >
            All
          </Link>
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/food-academy?category=${encodeURIComponent(category.slug)}`}
              aria-current={query.category === category.slug ? "page" : undefined}
              className={cn("rounded-full border px-4 py-1.5 text-small", query.category === category.slug ? "border-chilli bg-chilli text-white" : "border-input")}
            >
              {category.name}
            </Link>
          ))}
        </nav>
        <nav aria-label="Filter by content type" className="mt-2 flex flex-wrap gap-2">
          {CONTENT_TYPES.map((contentType) => (
            <Link
              key={contentType}
              href={`/food-academy?contentType=${encodeURIComponent(contentType)}`}
              aria-current={query.contentType === contentType ? "page" : undefined}
              className={cn("rounded-full border px-4 py-1.5 text-small", query.contentType === contentType ? "border-chilli bg-chilli text-white" : "border-input")}
            >
              {contentType}
            </Link>
          ))}
        </nav>

        <h2 id="food-academy-results-heading" className="sr-only">
          Food Academy results
        </h2>
        {result.entries.length === 0 ? (
          <p className="mt-8 text-body text-charcoal/70">No Food Academy entries match that filter.</p>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {result.entries.map((entry) => (
              <FoodAcademyCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}
        <ItemListJsonLd items={result.entries.map((entry) => ({ href: entry.href, name: entry.title }))} />
      </Section>

      <FoodAcademyPageJsonLd name={settings.seoTitle} description={settings.seoMetaDescription} />
    </>
  );
}
