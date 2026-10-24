import { ArrowRight, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { ScrollReveal } from "@/components/motion";
import { Container } from "@/components/storefront/layout/container";
import { Button } from "@/components/ui/button";
import type { ExportHeroData } from "@/types/home";

export interface HeadlineSegment {
  text: string;
  highlighted: boolean;
}

/**
 * Splits on **double asterisks** — the admin-facing markup convention for
 * highlighting one word/phrase in the headline (see ExportHeroSetting's
 * schema comment). Unbalanced/missing markers simply fail to match, so the
 * whole string comes back as one plain, non-highlighted segment rather than
 * throwing or dropping text.
 */
export function parseHighlightedHeadline(headline: string): HeadlineSegment[] {
  return headline
    .split(/\*\*(.+?)\*\*/)
    .map((text, index) => ({ text, highlighted: index % 2 === 1 }))
    .filter((segment) => segment.text.length > 0);
}

/**
 * Premium, admin-controllable homepage Export Solutions hero (replaces
 * ExportBanner as the default for this section) — a priority
 * business-conversion section for international distributors, importers
 * and retailers. Content comes from ExportHeroSetting via
 * export-hero.service.ts::getExportHeroForStorefront, which already merges
 * in exportHeroDefaults for any field an admin hasn't set yet, so this
 * component can assume every field it actually renders is non-empty.
 */
export function ExportHero({ data }: { data: ExportHeroData }) {
  const hasCtaRow = Boolean(data.primaryCtaLabel && data.primaryCtaHref) || Boolean(data.secondaryCtaLabel && data.secondaryCtaHref);
  const statLine = data.statLine ?? [];

  return (
    <section className="relative isolate overflow-hidden bg-charcoal">
      {data.backgroundImageUrl && (
        <Image
          src={data.backgroundImageUrl}
          alt=""
          fill
          sizes="100vw"
          priority
          className="object-cover"
        />
      )}
      {/* Background image is decorative — the overlaid text carries the real content, so alt="" above is intentional, not an oversight. */}
      <div className="absolute inset-0 bg-gradient-to-r from-charcoal via-charcoal/85 to-charcoal/50" />

      <Container size="wide" className="relative py-20 md:py-28">
        <ScrollReveal>
          <div className="grid gap-10 lg:grid-cols-[1fr_320px] lg:items-start lg:gap-16">
            <div className="max-w-2xl">
              {data.eyebrow && <p className="text-small font-medium tracking-wide text-gold uppercase">{data.eyebrow}</p>}
              {data.headline && (
                <h2 className="mt-3 text-h1 font-heading text-cream">
                  {parseHighlightedHeadline(data.headline).map((segment, index) => (
                    <span key={index} className={segment.highlighted ? "italic text-gold" : undefined}>
                      {segment.text}
                    </span>
                  ))}
                </h2>
              )}
              {data.description && <p className="mt-5 text-body text-cream/80">{data.description}</p>}

              {hasCtaRow && (
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                  {data.primaryCtaLabel && data.primaryCtaHref && (
                    <Button className="bg-gold text-charcoal hover:bg-gold/90" nativeButton={false} render={<Link href={data.primaryCtaHref} />}>
                      {data.primaryCtaLabel}
                      <ArrowUpRight className="size-4" aria-hidden="true" />
                    </Button>
                  )}
                  {data.secondaryCtaLabel && data.secondaryCtaHref && (
                    <Button
                      className="border-cream bg-transparent text-cream hover:bg-cream/10"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={data.secondaryCtaHref} />}
                    >
                      {data.secondaryCtaLabel}
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              )}

              {statLine.length > 0 && (
                <div className="mt-10 flex flex-wrap gap-x-10 gap-y-4 border-t border-cream/20 pt-8">
                  {statLine.map((stat, index) => (
                    <div key={index}>
                      <p className="text-small font-medium text-cream">{stat.label}</p>
                      <p className="text-caption text-cream/60">{stat.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {data.badge && (
              <div className="rounded-xl bg-cream p-6 shadow-2xl lg:mt-6">
                {data.badge.eyebrow && <p className="text-caption font-medium tracking-wide text-chilli uppercase">{data.badge.eyebrow}</p>}
                {data.badge.headline && <p className="mt-2 text-h4 font-heading text-charcoal">{data.badge.headline}</p>}
                {data.badge.description && <p className="mt-2 text-small text-charcoal/70">{data.badge.description}</p>}
                {data.badge.ctaLabel && data.badge.ctaHref && (
                  <Link href={data.badge.ctaHref} className="mt-4 inline-flex items-center gap-1 text-small font-medium text-chilli hover:underline">
                    {data.badge.ctaLabel}
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  </Link>
                )}
              </div>
            )}
          </div>
        </ScrollReveal>
      </Container>
    </section>
  );
}
