import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { HeroBannerSlide } from "@/components/storefront/home/hero-banner-slide";
import { getPublishedLandingPageBySlug } from "@/services/landing-page.service";

interface LandingPageProps {
  params: Promise<{ slug: string }>;
}

// generateMetadata and the page body both need the landing page — cache()
// dedupes the fetch to one call per request, same pattern as /recipes/[slug].
const getCachedLandingPage = cache(getPublishedLandingPageBySlug);

export async function generateMetadata({ params }: LandingPageProps): Promise<Metadata> {
  const { slug } = await params;
  const landingPage = await getCachedLandingPage(slug);
  if (!landingPage) return {};

  const firstBlock = landingPage.blocks[0];
  return {
    title: landingPage.metaTitle ?? landingPage.name,
    description: landingPage.metaDescription ?? firstBlock?.supportingText ?? firstBlock?.subheadline ?? undefined,
  };
}

export default async function LandingPage({ params }: LandingPageProps) {
  const { slug } = await params;
  const landingPage = await getCachedLandingPage(slug);
  if (!landingPage) notFound();

  return (
    <>
      {landingPage.blocks.map((block) => (
        <HeroBannerSlide
          key={block.id}
          data={{
            headline: block.headline,
            subheadline: block.subheadline,
            supportingText: block.supportingText,
            ctaLabel: block.ctaLabel,
            ctaHref: block.ctaHref,
            secondaryCtaLabel: block.secondaryCtaLabel,
            secondaryCtaHref: block.secondaryCtaHref,
            desktopImageUrl: block.desktopImageUrl,
            desktopImageAlt: block.desktopImageAlt,
            mobileImageUrl: block.mobileImageUrl,
            mobileImageAlt: block.mobileImageAlt,
            videoUrl: block.videoUrl,
            overlayEnabled: block.overlayEnabled,
            alignment: block.alignment,
          }}
        />
      ))}
    </>
  );
}
