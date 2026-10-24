import Link from "next/link";

import { ScrollReveal } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/storefront/layout/section";
import type { TeaserSectionData } from "@/types/home";

/**
 * A bolder, image-less alternative to TeaserSection for the homepage's
 * export callout — a solid dark card with a single clear CTA, matching the
 * brief's "prominent link to the export catalogue" ask. Deliberately a
 * separate component rather than a TeaserSection variant: TeaserSection is
 * shared verbatim by Food Academy and Rewards Club, and this treatment
 * (no image, solid background) is structurally different enough that
 * reusing it would mean a parameter explosion or compromising those two
 * sections.
 */
export function ExportBanner({ data }: { data: TeaserSectionData }) {
  return (
    <Section>
      <ScrollReveal>
        <div className="flex flex-col items-start gap-6 rounded-xl bg-charcoal px-8 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-12">
          <div>
            <p className="text-small font-medium tracking-wide text-gold uppercase">{data.eyebrow}</p>
            <h2 className="mt-2 text-h2 font-heading text-cream">{data.headline}</h2>
            <p className="mt-4 max-w-xl text-body text-cream/80">{data.description}</p>
          </div>
          {/* variant="outline" defaults to bg-background (light) — on this
              dark card that left cream text on a near-white button,
              effectively invisible. bg-transparent overrides it so the
              button reads as a true cream outline against the charcoal card. */}
          <Button
            className="w-full shrink-0 border-cream bg-transparent text-cream hover:bg-cream/10 sm:w-auto"
            variant="outline"
            nativeButton={false}
            render={<Link href={data.ctaHref} />}
          >
            {data.ctaLabel}
          </Button>
        </div>
      </ScrollReveal>
    </Section>
  );
}
