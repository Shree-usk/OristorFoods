import Link from "next/link";

import { ScrollReveal } from "@/components/motion";
import { globalJourneyContent } from "@/lib/story-content";

/** STORY-073. "From Sri Lanka to the World" — CTA links to the real, already-shipped /export page (STORY-058), no new destination needed. */
export function GlobalJourney() {
  return (
    <ScrollReveal>
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-h2 font-heading text-charcoal">{globalJourneyContent.title}</h2>
        <p className="mt-4 text-body text-charcoal/80">{globalJourneyContent.body}</p>
        <Link href={globalJourneyContent.ctaHref} className="mt-6 inline-block text-small font-medium text-chilli hover:underline">
          {globalJourneyContent.ctaLabel}
        </Link>
      </div>
    </ScrollReveal>
  );
}
