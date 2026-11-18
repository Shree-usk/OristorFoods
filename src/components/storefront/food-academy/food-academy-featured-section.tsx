import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ScrollReveal } from "@/components/motion";
import { Section } from "@/components/storefront/layout/section";
import { FoodAcademyCard } from "@/components/storefront/food-academy/food-academy-card";
import type { FoodAcademyEntryCard } from "@/types/food-academy";

/**
 * "Featured learning content" — admin-curated (FoodAcademyEntry.sortOrder,
 * ordered via the Food Academy CMS's drag-reorder panel), not recency.
 * Replaces the hub page's previous headingless featured block with this
 * admin-labelled section; same underlying listFeaturedEntries() data and
 * the same "hide while a filter is active" rule.
 */
export function FoodAcademyFeaturedSection({
  heading,
  description,
  entries,
}: {
  heading: string;
  description: string;
  entries: FoodAcademyEntryCard[];
}) {
  if (entries.length === 0) return null;

  return (
    <Section className="bg-beige" spacing="lg">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <ScrollReveal>
          <h2 className="text-h2 font-heading text-charcoal">{heading}</h2>
          {description && <p className="mt-2 max-w-xl text-body text-charcoal/70">{description}</p>}
        </ScrollReveal>
        <Link href="/food-academy" className="flex items-center gap-1 text-small font-medium text-chilli hover:underline">
          View all
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {entries.map((entry) => (
          <FoodAcademyCard key={entry.id} entry={entry} />
        ))}
      </div>
    </Section>
  );
}
