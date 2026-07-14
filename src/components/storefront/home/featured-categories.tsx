import Image from "next/image";
import Link from "next/link";

import { ScrollReveal } from "@/components/motion";
import { Section } from "@/components/storefront/layout/section";
import type { CategoryCardData } from "@/types/home";

export function FeaturedCategories({ categories }: { categories: CategoryCardData[] }) {
  return (
    <Section>
      <h2 className="text-h2 font-heading text-charcoal">Shop by Category</h2>
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {categories.map((category, index) => (
          <ScrollReveal key={category.id} delay={index * 0.05}>
            <Link href={category.href} className="group block">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-beige">
                <Image
                  src={category.imageSrc}
                  alt={category.imageAlt}
                  fill
                  sizes="(min-width: 1024px) 16vw, (min-width: 640px) 30vw, 45vw"
                  className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <p className="mt-3 text-center text-small font-medium text-charcoal">{category.name}</p>
            </Link>
          </ScrollReveal>
        ))}
      </div>
    </Section>
  );
}
