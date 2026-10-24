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
        A real grid, not flex-wrap — every card in a row must be the exact
        same width AND height regardless of how long each category's own
        description is. Grid's default cross-axis stretch handles the
        height automatically; flex-col + flex-1 + mt-auto inside each card
        pins "Explore category" to the same bottom edge either way, and
        line-clamp-2 caps the description so one unusually long entry can't
        blow out its own row.
      */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {categories.map((category, index) => (
          <ScrollReveal key={category.id} delay={index * 0.05} className="h-full">
            <Link
              href={category.href}
              className="group flex h-full flex-col overflow-hidden rounded-lg border border-border-soft bg-cream transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
            >
              <div className="relative aspect-square shrink-0">
                <Image
                  src={category.imageSrc}
                  alt={category.imageAlt}
                  fill
                  sizes="(min-width: 1024px) 20vw, (min-width: 640px) 30vw, 45vw"
                  className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="flex flex-1 flex-col border-t border-border-soft px-3 py-3 text-center">
                <p className="text-small font-medium text-charcoal">{category.name}</p>
                {category.description && <p className="mt-1 line-clamp-2 text-caption text-charcoal/70">{category.description}</p>}
                <span className="mt-auto inline-flex items-center justify-center gap-1 pt-2 text-caption font-medium text-chilli">
                  Explore category
                  <ArrowRight className="size-3 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </div>
            </Link>
          </ScrollReveal>
        ))}
      </div>
    </Section>
  );
}
