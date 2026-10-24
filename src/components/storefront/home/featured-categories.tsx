import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ScrollReveal } from "@/components/motion";
import { Section } from "@/components/storefront/layout/section";
import type { CategoryCardData } from "@/types/home";

export function FeaturedCategories({ categories, titleOverride }: { categories: CategoryCardData[]; titleOverride?: string | null }) {
  return (
    <Section>
      <h2 className="text-h2 font-heading text-charcoal">{titleOverride || "Shop by Category"}</h2>
      {/*
        flex-wrap + basis, not a fixed grid-cols-6 — the category count is
        admin-managed and varies (e.g. 5), so a fixed 6-column grid leaves a
        ragged, off-center gap whenever the count isn't a clean multiple of
        the column count at a given breakpoint. justify-center keeps a
        trailing partial row centered instead.
      */}
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        {categories.map((category, index) => (
          <ScrollReveal key={category.id} delay={index * 0.05} className="w-[calc(50%-0.5rem)] sm:w-[calc(33.333%-0.667rem)] lg:w-[calc(16.667%-0.834rem)]">
            <Link href={category.href} className="group block">
              <div className="overflow-hidden rounded-lg border border-border-soft bg-cream transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-md">
                <div className="relative aspect-square">
                  <Image
                    src={category.imageSrc}
                    alt={category.imageAlt}
                    fill
                    sizes="(min-width: 1024px) 16vw, (min-width: 640px) 30vw, 45vw"
                    className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="border-t border-border-soft px-3 py-3 text-center">
                  <p className="text-small font-medium text-charcoal">{category.name}</p>
                  {category.description && <p className="mt-1 text-caption text-charcoal/70">{category.description}</p>}
                  <span className="mt-2 inline-flex items-center gap-1 text-caption font-medium text-chilli">
                    Explore category
                    <ArrowRight className="size-3 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </div>
              </div>
            </Link>
          </ScrollReveal>
        ))}
      </div>
    </Section>
  );
}
