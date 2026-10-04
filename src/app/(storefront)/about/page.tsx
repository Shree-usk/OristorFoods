import type { Metadata } from "next";

import { JsonLdScript } from "@/components/storefront/product/json-ld-script";
import { Section } from "@/components/storefront/layout/section";
import { GlobalJourney } from "@/components/storefront/story/global-journey";
import { IngredientReveal } from "@/components/storefront/story/ingredient-reveal";
import { ProductStoryScroll } from "@/components/storefront/story/product-story-scroll";
import { StoryChapter } from "@/components/storefront/story/story-chapter";
import { StoryCTA } from "@/components/storefront/story/story-cta";
import { StoryHero } from "@/components/storefront/story/story-hero";
import { ValueReveal } from "@/components/storefront/story/value-reveal";
import { companyChapter, landChapter, qualityChapter, traditionChapter } from "@/lib/story-content";
import { getResolvedCompanyInfo } from "@/services/system-settings.service";

export const metadata: Metadata = {
  title: "Our Story",
  description:
    "From our roots to your table — the story of ORISTOR, Sri Lankan heritage, real ingredients, and the journey from a home kitchen to kitchens around the world.",
  alternates: { canonical: "/about" },
};

export default async function AboutPage() {
  const companyInfo = await getResolvedCompanyInfo();

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

      <StoryHero />

      <Section>
        <StoryChapter {...landChapter} />
      </Section>

      <Section className="bg-cream">
        <IngredientReveal />
      </Section>

      <Section>
        <StoryChapter {...traditionChapter} />
      </Section>

      <Section className="bg-cream">
        <StoryChapter {...companyChapter} />
      </Section>

      <Section containerSize={false} spacing="sm">
        <ProductStoryScroll />
      </Section>

      <Section>
        <div className="mx-auto max-w-2xl">
          <ValueReveal />
        </div>
      </Section>

      <Section className="bg-cream">
        <StoryChapter {...qualityChapter} />
      </Section>

      <Section>
        <GlobalJourney />
      </Section>

      <Section className="bg-cream">
        <StoryCTA />
      </Section>
    </>
  );
}
