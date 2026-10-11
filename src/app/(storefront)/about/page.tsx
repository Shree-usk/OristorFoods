import type { Metadata } from "next";
import { connection } from "next/server";

import { InstagramGallery } from "@/components/storefront/home/instagram-gallery";
import { JsonLdScript } from "@/components/storefront/product/json-ld-script";
import { Section } from "@/components/storefront/layout/section";
import { GlobalJourney } from "@/components/storefront/story/global-journey";
import { HistoryTimeline } from "@/components/storefront/story/history-timeline";
import { IngredientReveal } from "@/components/storefront/story/ingredient-reveal";
import { ProductStoryScroll } from "@/components/storefront/story/product-story-scroll";
import { StoryChapter } from "@/components/storefront/story/story-chapter";
import { StoryCTA } from "@/components/storefront/story/story-cta";
import { StoryHero } from "@/components/storefront/story/story-hero";
import { ValueReveal } from "@/components/storefront/story/value-reveal";
import { instagramPosts } from "@/lib/fixtures/home-fixtures";
import { getRecentPostsForStorefront } from "@/services/instagram.service";
import { getPublishedStoryBlocks } from "@/services/story-page.service";
import { getResolvedCompanyInfo } from "@/services/system-settings.service";
import type { InstagramPostData } from "@/types/home";
import type { StoryChapterContent } from "@/types/story";

export const metadata: Metadata = {
  title: "Our Story",
  description:
    "From our roots to your table — the story of ORISTOR, Sri Lankan heritage, real ingredients, and the journey from a home kitchen to kitchens around the world.",
  alternates: { canonical: "/about" },
};

function toChapter(block: Awaited<ReturnType<typeof getPublishedStoryBlocks>>[number]): StoryChapterContent {
  return {
    id: block.blockKey,
    eyebrow: block.eyebrow ?? "",
    title: block.title ?? "",
    body: block.body ?? "",
    image: { src: block.imageUrl ?? "", alt: block.imageAlt ?? "" },
    align: block.align === "Right" ? "Right" : "Left",
  };
}

export default async function AboutPage() {
  // Forces this route dynamic, same as (storefront)/page.tsx's own
  // Homepage Builder precedent — without it, `next build` statically
  // prerenders this page once (and in CI, before any seed has run,
  // crashes outright on the missing-content check below). Admin edits
  // via /admin/story-pages also need this: a static page would keep
  // serving its build-time snapshot until the next redeploy.
  await connection();

  const [companyInfo, blocks, syncedInstagramPosts] = await Promise.all([
    getResolvedCompanyInfo(),
    getPublishedStoryBlocks("AboutUs"),
    getRecentPostsForStorefront(6),
  ]);
  // Same real-data-with-fixture-fallback pattern as the homepage's own
  // Instagram section (homepage-sections.tsx) — never an empty section.
  const resolvedInstagramPosts: InstagramPostData[] =
    syncedInstagramPosts.length > 0
      ? syncedInstagramPosts.map((post) => ({
          id: post.id,
          imageSrc: post.imageUrl,
          imageAlt: post.caption ? post.caption.slice(0, 120) : "Oristor Instagram post",
          href: post.permalink,
        }))
      : instagramPosts;

  const hero = blocks.find((block) => block.blockType === "Hero");
  const chapters = blocks.filter((block) => block.blockType === "Chapter").map(toChapter);
  const landChapter = chapters.find((chapter) => chapter.id === "the-land");
  const traditionChapter = chapters.find((chapter) => chapter.id === "tradition-in-every-recipe");
  const companyChapter = chapters.find((chapter) => chapter.id === "from-tradition-to-the-oristor");
  const qualityChapter = chapters.find((chapter) => chapter.id === "quality-and-trust");
  const ingredients = blocks
    .filter((block) => block.blockType === "IngredientItem")
    .map((block) => ({ name: block.title ?? "", tagline: block.body ?? "", image: { src: block.imageUrl ?? "", alt: block.imageAlt ?? "" } }));
  const categories = blocks
    .filter((block) => block.blockType === "ProductCategoryItem")
    .map((block) => ({ id: block.blockKey, name: block.title ?? "", tagline: block.body ?? "", image: { src: block.imageUrl ?? "", alt: block.imageAlt ?? "" } }));
  const values = blocks
    .filter((block) => block.blockType === "ValueItem")
    .map((block) => ({ letter: block.letter ?? "", word: block.title ?? "", description: block.body ?? "" }));
  const milestones = blocks
    .filter((block) => block.blockType === "Milestone")
    .map((block) => ({
      id: block.blockKey,
      year: block.eyebrow ?? "",
      title: block.title ?? "",
      body: block.body ?? "",
      image: block.imageUrl ? { src: block.imageUrl, alt: block.imageAlt ?? "" } : null,
    }));
  const markets = blocks
    .filter((block) => block.blockType === "MarketItem")
    .map((block) => ({ id: block.blockKey, name: block.title ?? "", body: block.body ?? "" }));
  const globalJourney = blocks.find((block) => block.blockType === "GlobalJourney");
  const cta = blocks.find((block) => block.blockType === "Cta");

  if (!hero || !landChapter || !traditionChapter || !companyChapter || !qualityChapter || !globalJourney || !cta) {
    // Never happens once the seed has run (prisma db seed) — StoryPageBlock is never left empty in a real environment.
    throw new Error("About page content is missing. Run `npx prisma db seed` to populate StoryPageBlock rows.");
  }

  return (
    <>
      <JsonLdScript
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: companyInfo.companyName,
          email: companyInfo.email,
          telephone: companyInfo.phone,
          address: { "@type": "PostalAddress", streetAddress: companyInfo.address },
        }}
      />

      <StoryHero eyebrow={hero.eyebrow ?? ""} headline={hero.title ?? ""} subcopy={hero.body ?? ""} image={{ src: hero.imageUrl ?? "", alt: hero.imageAlt ?? "" }} />

      <Section>
        <StoryChapter {...landChapter} />
      </Section>

      <Section className="bg-cream">
        <IngredientReveal ingredients={ingredients} />
      </Section>

      <Section>
        <StoryChapter {...traditionChapter} />
      </Section>

      <Section className="bg-cream">
        <StoryChapter {...companyChapter} />
      </Section>

      {milestones.length > 0 && (
        <Section>
          <HistoryTimeline milestones={milestones} />
        </Section>
      )}

      <Section containerSize={false} spacing="sm">
        <ProductStoryScroll categories={categories} />
      </Section>

      <Section>
        <div className="mx-auto max-w-2xl">
          <ValueReveal values={values} />
        </div>
      </Section>

      <Section className="bg-cream">
        <StoryChapter {...qualityChapter} />
      </Section>

      <Section>
        <GlobalJourney
          title={globalJourney.title ?? ""}
          body={globalJourney.body ?? ""}
          ctaLabel={globalJourney.ctaLabel ?? ""}
          ctaHref={globalJourney.ctaHref ?? ""}
          markets={markets}
        />
      </Section>

      <Section>
        <InstagramGallery posts={resolvedInstagramPosts} />
      </Section>

      <Section className="bg-cream">
        <StoryCTA
          headline={cta.title ?? ""}
          subcopy={cta.body ?? ""}
          primaryLabel={cta.ctaLabel ?? ""}
          primaryHref={cta.ctaHref ?? ""}
          secondaryLabel={cta.secondaryCtaLabel ?? ""}
          secondaryHref={cta.secondaryCtaHref ?? ""}
        />
      </Section>
    </>
  );
}
