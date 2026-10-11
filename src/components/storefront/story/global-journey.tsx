import Link from "next/link";

import { ScrollReveal } from "@/components/motion";
import type { GlobalJourneyContent, MarketItemContent } from "@/types/story";

/**
 * STORY-073. "From Sri Lanka to the World" — CTA links to the real,
 * already-shipped /export page (STORY-058), no new destination needed.
 *
 * `markets` is optional and renders as a small inline list under the
 * copy — kept inside this section rather than as a separate "Visit Us"
 * style block, since a second standalone "we're global" section right
 * next to this one would read as repetitive.
 */
export function GlobalJourney({ title, body, ctaLabel, ctaHref, markets = [] }: GlobalJourneyContent & { markets?: MarketItemContent[] }) {
  return (
    <ScrollReveal>
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-h2 font-heading text-charcoal">{title}</h2>
        <p className="mt-4 text-body text-charcoal/80">{body}</p>

        {markets.length > 0 && (
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            {markets.map((market) => (
              <div key={market.id} className="rounded-lg border border-border px-4 py-2 text-left">
                <p className="text-small font-medium text-charcoal">{market.name}</p>
                <p className="mt-0.5 text-caption text-charcoal/70">{market.body}</p>
              </div>
            ))}
          </div>
        )}

        <Link href={ctaHref} className="mt-6 inline-block text-small font-medium text-chilli hover:underline">
          {ctaLabel}
        </Link>
      </div>
    </ScrollReveal>
  );
}
