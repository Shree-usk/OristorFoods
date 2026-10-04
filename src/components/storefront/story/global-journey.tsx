import Link from "next/link";

import { ScrollReveal } from "@/components/motion";
import type { GlobalJourneyContent } from "@/types/story";

/** STORY-073. "From Sri Lanka to the World" — CTA links to the real, already-shipped /export page (STORY-058), no new destination needed. */
export function GlobalJourney({ title, body, ctaLabel, ctaHref }: GlobalJourneyContent) {
  return (
    <ScrollReveal>
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-h2 font-heading text-charcoal">{title}</h2>
        <p className="mt-4 text-body text-charcoal/80">{body}</p>
        <Link href={ctaHref} className="mt-6 inline-block text-small font-medium text-chilli hover:underline">
          {ctaLabel}
        </Link>
      </div>
    </ScrollReveal>
  );
}
