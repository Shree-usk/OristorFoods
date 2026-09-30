import Image from "next/image";
import Link from "next/link";

import { ScrollReveal } from "@/components/motion";
import { fadeIn } from "@/components/motion/variants";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface HeroBannerSlideData {
  headline: string;
  subheadline: string | null;
  supportingText: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  secondaryCtaLabel: string | null;
  secondaryCtaHref: string | null;
  desktopImageUrl: string;
  desktopImageAlt: string;
  mobileImageUrl: string | null;
  mobileImageAlt: string | null;
  videoUrl: string | null;
  overlayEnabled: boolean;
  alignment: "Left" | "Center" | "Right";
}

const ALIGNMENT_CLASSES: Record<HeroBannerSlideData["alignment"], string> = {
  Left: "items-start text-left",
  Center: "items-center text-center mx-auto",
  Right: "items-end text-right ml-auto",
};

/**
 * STORY-042's DB-backed Hero Banner slide renderer — used once a
 * HomepageLayout has been published (STORY-Additional's overlay,
 * alignment, secondary CTA, mobile art-direction, and optional video, on
 * top of STORY-006's original single-CTA HeroBanner). The pre-STORY-042
 * `HeroBanner` component (src/components/storefront/home/hero-banner.tsx)
 * stays untouched and is used only for the fixture-driven fallback when
 * no layout has ever been published — see docs/architecture-decisions.md.
 */
export function HeroBannerSlide({ data }: { data: HeroBannerSlideData }) {
  return (
    <section className="relative flex min-h-[32rem] items-center overflow-hidden bg-charcoal text-ivory sm:min-h-[36rem]">
      {data.videoUrl ? (
        <video src={data.videoUrl} poster={data.desktopImageUrl} autoPlay muted loop playsInline className="absolute inset-0 size-full object-cover opacity-40" />
      ) : (
        <>
          <Image
            src={data.desktopImageUrl}
            alt={data.desktopImageAlt}
            fill
            priority
            sizes="100vw"
            className={cn("object-cover opacity-40", data.mobileImageUrl ? "hidden sm:block" : "block")}
          />
          {data.mobileImageUrl && (
            <Image src={data.mobileImageUrl} alt={data.mobileImageAlt ?? data.desktopImageAlt} fill priority sizes="100vw" className="object-cover opacity-40 sm:hidden" />
          )}
        </>
      )}
      {data.overlayEnabled && <div className="absolute inset-0 bg-black/40" />}
      <div className="relative mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <ScrollReveal variant={fadeIn} className={cn("flex max-w-2xl flex-col", ALIGNMENT_CLASSES[data.alignment])}>
          <h1 className="text-h1 font-heading sm:text-hero">{data.headline}</h1>
          {data.subheadline && <p className="mt-4 text-body text-ivory/85 sm:text-h4 sm:font-heading">{data.subheadline}</p>}
          {data.supportingText && <p className="mt-2 text-small text-ivory/70">{data.supportingText}</p>}
          {(data.ctaLabel || data.secondaryCtaLabel) && (
            <div className="mt-8 flex flex-wrap gap-3">
              {data.ctaLabel && data.ctaHref && (
                <Button size="lg" nativeButton={false} render={<Link href={data.ctaHref} />}>
                  {data.ctaLabel}
                </Button>
              )}
              {data.secondaryCtaLabel && data.secondaryCtaHref && (
                <Button size="lg" variant="outline" nativeButton={false} render={<Link href={data.secondaryCtaHref} />}>
                  {data.secondaryCtaLabel}
                </Button>
              )}
            </div>
          )}
        </ScrollReveal>
      </div>
    </section>
  );
}
