import Image from "next/image";

import { ScrollReveal } from "@/components/motion";
import { flavoursChapter } from "@/lib/story-content";

/**
 * STORY-073. Chapter 02 — a few real ingredients, briefly revealed, not
 * an exhaustive list ("do not overuse text" per the brief). Each item
 * uses its own `ScrollReveal` (staggered via `delay`) rather than a raw
 * `motion.div` + `staggerContainer` — `ScrollReveal` already handles
 * `prefers-reduced-motion` internally; reaching for raw Framer Motion
 * here would mean re-implementing that same check for no real benefit.
 */
export function IngredientReveal() {
  return (
    <div>
      <ScrollReveal>
        <p className="text-small font-medium tracking-wide text-chilli uppercase">{flavoursChapter.eyebrow}</p>
        <h2 className="mt-2 text-h2 font-heading text-charcoal">{flavoursChapter.title}</h2>
      </ScrollReveal>

      <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-3">
        {flavoursChapter.ingredients.map((ingredient, index) => (
          <ScrollReveal key={ingredient.name} delay={index * 0.1} className="text-center">
            <div className="relative mx-auto aspect-square size-32 overflow-hidden rounded-full bg-cream">
              <Image src={ingredient.image.src} alt={ingredient.image.alt} fill sizes="128px" className="object-cover" />
            </div>
            <h3 className="mt-4 text-h5 font-heading text-charcoal uppercase">{ingredient.name}</h3>
            <p className="mt-1 text-small text-charcoal/80">{ingredient.tagline}</p>
          </ScrollReveal>
        ))}
      </div>
    </div>
  );
}
