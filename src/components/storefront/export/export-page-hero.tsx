import Image from "next/image";
import Link from "next/link";

import { ScrollReveal } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/storefront/layout/container";

export interface ExportPageHeroData {
  backgroundImageUrl: string | null;
  backgroundImageAlt: string | null;
  eyebrow: string | null;
  headline: string | null;
  description: string | null;
  primaryCtaLabel: string | null;
  primaryCtaHref: string | null;
  secondaryCtaLabel: string | null;
  secondaryCtaHref: string | null;
}

/**
 * The /export page's own hero — 1/3 image, 2/3 content, per the approved
 * design (deliberately a different layout from the homepage's full-bleed
 * ExportHero; see export-content.service.ts's doc comment on why they're
 * separate admin settings). Falls back to the page's original approved
 * copy per-field, so this never renders blank before an admin configures it.
 * Wrapped in the site's wide Container so the whole hero sits centered
 * with equal left/right margins at very wide viewports, same as every
 * other section on the page, instead of stretching edge-to-edge.
 */
export function ExportPageHero({ data }: { data: ExportPageHeroData }) {
  const hasCtaRow = Boolean(data.primaryCtaLabel && data.primaryCtaHref) || Boolean(data.secondaryCtaLabel && data.secondaryCtaHref);

  return (
    <section className="bg-cream">
      <Container size="wide" className="grid grid-cols-1 gap-8 lg:grid-cols-[2fr_1fr] lg:gap-12">
        <ScrollReveal>
          <div className="flex h-full flex-col justify-center py-14 lg:py-20">
            {data.eyebrow && <p className="text-small font-medium tracking-wide text-chilli uppercase">{data.eyebrow}</p>}
            {data.headline && <h1 className="mt-2 max-w-xl text-h1 font-heading text-charcoal">{data.headline}</h1>}
            {data.description && <p className="mt-4 max-w-xl text-body text-charcoal/75">{data.description}</p>}
            {hasCtaRow && (
              <div className="mt-7 flex flex-wrap gap-3">
                {data.primaryCtaLabel && data.primaryCtaHref && (
                  <Button nativeButton={false} render={<Link href={data.primaryCtaHref} />}>
                    {data.primaryCtaLabel}
                  </Button>
                )}
                {data.secondaryCtaLabel && data.secondaryCtaHref && (
                  <Button variant="outline" nativeButton={false} render={<Link href={data.secondaryCtaHref} />}>
                    {data.secondaryCtaLabel}
                  </Button>
                )}
              </div>
            )}
          </div>
        </ScrollReveal>
        {data.backgroundImageUrl && (
          <div className="relative min-h-56 lg:min-h-full">
            <Image src={data.backgroundImageUrl} alt={data.backgroundImageAlt ?? ""} fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover" priority />
          </div>
        )}
      </Container>
    </section>
  );
}
