import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { ScrollReveal } from "@/components/motion";
import { Section } from "@/components/storefront/layout/section";
import type { FoodAcademyCategoryTile } from "@/types/food-academy";

/**
 * "Explore the world of flavour" subject tiles — one per active Food
 * Academy category. Links reuse the hub page's existing `?category=<slug>`
 * filter contract verbatim, so a click here is indistinguishable from
 * picking the same category from the filter chips below.
 */
export function FoodAcademyCategoryTiles({
  heading,
  description,
  categories,
}: {
  heading: string;
  description: string;
  categories: FoodAcademyCategoryTile[];
}) {
  if (categories.length === 0) return null;

  return (
    <Section>
      <ScrollReveal>
        <h2 className="text-h2 font-heading text-charcoal">{heading}</h2>
        {description && <p className="mt-2 max-w-xl text-body text-charcoal/70">{description}</p>}
      </ScrollReveal>
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category, index) => (
          <ScrollReveal key={category.id} delay={index * 0.05}>
            <Link
              href={`/food-academy?category=${encodeURIComponent(category.slug)}`}
              className="group relative flex min-h-56 flex-col justify-end overflow-hidden rounded-lg bg-beige p-6"
            >
              {category.tileImageUrl && (
                <Image
                  src={category.tileImageUrl}
                  alt={category.tileImageAlt ?? ""}
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-charcoal/10 to-transparent" aria-hidden="true" />
              <div className="relative">
                <p className="text-caption font-medium tracking-wide text-gold-light uppercase">{String(index + 1).padStart(2, "0")}</p>
                <h3 className="mt-1 text-h4 font-heading text-cream">{category.name}</h3>
                {category.description && <p className="mt-1 line-clamp-2 text-small text-cream/80">{category.description}</p>}
                <span className="mt-3 inline-flex items-center gap-1 text-small font-medium text-cream">
                  Explore
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </span>
              </div>
            </Link>
          </ScrollReveal>
        ))}
      </div>
    </Section>
  );
}
