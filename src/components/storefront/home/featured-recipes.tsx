import Image from "next/image";
import Link from "next/link";
import { Clock } from "lucide-react";

import { ScrollReveal } from "@/components/motion";
import { Section } from "@/components/storefront/layout/section";
import type { RecipeCardData } from "@/types/home";

export function FeaturedRecipes({ recipes }: { recipes: RecipeCardData[] }) {
  return (
    <Section className="bg-beige">
      <div className="flex items-baseline justify-between">
        <h2 className="text-h2 font-heading text-charcoal">Featured Recipes</h2>
        <Link href="/recipes" className="text-small text-chilli hover:underline">
          View all
        </Link>
      </div>
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {recipes.map((recipe, index) => (
          <ScrollReveal key={recipe.id} delay={index * 0.05}>
            <Link href={recipe.href} className="group block">
              <div className="relative aspect-4/3 overflow-hidden rounded-lg bg-cream">
                <Image
                  src={recipe.imageSrc}
                  alt={recipe.imageAlt}
                  fill
                  sizes="(min-width: 640px) 33vw, 90vw"
                  className="object-contain p-6 transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <p className="mt-3 text-h4 font-heading text-charcoal">{recipe.title}</p>
              <div className="mt-1 flex items-center gap-3 text-small text-charcoal/80">
                <span className="flex items-center gap-1">
                  <Clock className="size-3.5" aria-hidden="true" />
                  {recipe.cookTimeMinutes} min
                </span>
                <span>{recipe.difficulty}</span>
              </div>
            </Link>
          </ScrollReveal>
        ))}
      </div>
    </Section>
  );
}
