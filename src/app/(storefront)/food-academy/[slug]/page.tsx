import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Breadcrumbs } from "@/components/storefront/layout/breadcrumbs";
import { Section } from "@/components/storefront/layout/section";
import { FoodAcademyCard } from "@/components/storefront/food-academy/food-academy-card";
import { FoodAcademyJsonLd } from "@/components/storefront/food-academy/food-academy-json-ld";
import { FoodAcademySectionNav } from "@/components/storefront/food-academy/food-academy-section-nav";
import { RelatedRecipesBlock } from "@/components/storefront/food-academy/related-recipes-block";
import { RelatedProductsBlock } from "@/components/storefront/food-academy/related-products-block";
import { MarkdownContent } from "@/components/shared/markdown-content";
import { getEntryBySlug } from "@/services/food-academy.service";

const getCachedEntry = cache(getEntryBySlug);

interface FoodAcademyDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: FoodAcademyDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const entry = await getCachedEntry(slug);
  if (!entry) return {};
  return {
    title: entry.title,
    description: entry.summary,
    alternates: { canonical: `/food-academy/${slug}` },
  };
}

export default async function FoodAcademyDetailPage({ params }: FoodAcademyDetailPageProps) {
  const { slug } = await params;
  const entry = await getCachedEntry(slug);
  if (!entry) notFound();

  return (
    <Section>
      <Breadcrumbs items={[{ name: "Food Academy", href: "/food-academy" }, { name: entry.title, href: entry.href }]} />
      <FoodAcademyJsonLd
        name={entry.title}
        description={entry.summary}
        imageUrl={entry.heroImageUrl}
        authorName={entry.authorName}
        isCourse={entry.contentType === "Course"}
      />

      <h1 className="mt-4 text-h1 font-heading text-charcoal">{entry.title}</h1>
      <p className="mt-2 text-body text-charcoal/80">{entry.summary}</p>
      {entry.authorName && <p className="mt-1 text-caption text-charcoal/60">By {entry.authorName}</p>}
      {entry.readingTimeMinutes !== null && (
        <p className="mt-1 text-caption text-charcoal/60">{entry.readingTimeMinutes} min read</p>
      )}

      {entry.heroImageUrl && (
        <div className="relative mt-6 aspect-video w-full overflow-hidden rounded-lg bg-cream">
          <Image src={entry.heroImageUrl} alt="" fill className="object-cover" />
        </div>
      )}

      {entry.bodyContent && (
        <div className="mt-6 max-w-2xl">
          <MarkdownContent content={entry.bodyContent} />
        </div>
      )}

      {entry.contentType === "Course" && entry.sections.length > 0 && (
        <div className="mt-6 flex gap-8">
          <FoodAcademySectionNav sections={entry.sections} />
          <div className="min-w-0 flex-1 space-y-10">
            {entry.sections.map((section) => (
              <div key={section.id} id={`section-${section.sectionNumber}`}>
                <h2 className="text-h3 font-heading text-charcoal">{section.title}</h2>
                {section.imageUrl && (
                  <div className="relative mt-4 aspect-video w-full overflow-hidden rounded-lg bg-cream">
                    <Image src={section.imageUrl} alt="" fill className="object-cover" />
                  </div>
                )}
                <div className="mt-4 max-w-2xl">
                  <MarkdownContent content={section.bodyContent} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <RelatedRecipesBlock recipes={entry.relatedRecipes} />
      <RelatedProductsBlock products={entry.relatedProducts} />

      {entry.relatedEntries.length > 0 && (
        <div className="mt-10">
          <h2 className="text-h3 font-heading text-charcoal">Related reading</h2>
          <div className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-3">
            {entry.relatedEntries.map((related) => (
              <FoodAcademyCard key={related.id} entry={related} />
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}
