import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { ScrollReveal } from "@/components/motion";
import { Section } from "@/components/storefront/layout/section";
import type { FoodAcademyCategoryTile } from "@/types/food-academy";

/**
 * Homepage "Explore the world of flavour" strip — sits directly below the
 * FoodAcademyTeaser hero inside the same admin-toggled FoodAcademy section.
 * Cards are sourced from the real, admin-managed FoodAcademyCategory list
 * (the same data the /food-academy hub's own category tiles and filter
 * chips use), not fixture copy — so adding/editing a category in
 * Admin > Food Academy > Categories updates this strip too.
 */
export function FoodAcademyExploreCards({ categories }: { categories: FoodAcademyCategoryTile[] }) {
  const cards = categories.slice(0, 3);
  if (cards.length === 0) return null;

  return (
    <Section>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <ScrollReveal>
          <p className="text-small font-medium tracking-wide text-chilli uppercase">Learn with ORISTOR</p>
          <h2 className="mt-2 text-h2 font-heading text-charcoal">Explore the world of flavour</h2>
          <p className="mt-2 max-w-md text-body text-charcoal/70">Practical food knowledge, rooted in Sri Lankan tradition.</p>
        </ScrollReveal>
        <Link
          href="/food-academy"
          className="flex items-center gap-1 text-small font-medium text-chilli underline underline-offset-4 hover:no-underline"
        >
          Visit the Food Academy
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
        {cards.map((category, index) => (
          <ScrollReveal key={category.id} delay={index * 0.05}>
            <Link
              href={`/food-academy?category=${encodeURIComponent(category.slug)}`}
              className="group relative flex min-h-[170px] flex-col justify-between rounded-md border border-border-soft bg-cream p-6 transition-colors duration-300 hover:border-chilli/40"
            >
              <div>
                <p className="font-heading text-caption italic text-gold">
                  {String(index + 1).padStart(2, "0")} / {category.name.toUpperCase()}
                </p>
                <h3 className="mt-4 text-h4 font-heading text-charcoal">{category.name}</h3>
                {category.description && <p className="mt-2 line-clamp-2 max-w-xs text-small text-charcoal/70">{category.description}</p>}
              </div>
              <ArrowUpRight
                className="absolute bottom-5 right-5 size-5 text-chilli transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                aria-hidden="true"
              />
            </Link>
          </ScrollReveal>
        ))}
      </div>
    </Section>
  );
}
