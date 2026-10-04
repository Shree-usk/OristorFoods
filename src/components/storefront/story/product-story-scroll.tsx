"use client";

import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

import { ScrollReveal } from "@/components/motion";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { ProductCategoryContent } from "@/types/story";

interface ProductStoryScrollProps {
  categories: ProductCategoryContent[];
}

/**
 * STORY-073. The one genuinely new piece of motion infrastructure this
 * story adds — no `useScroll`/`useTransform` precedent existed anywhere
 * in this codebase before. Desktop + no reduced-motion preference: a
 * pinned (`position: sticky`) horizontal sequence through the real
 * product categories, driven by scroll progress. Mobile, or reduced
 * motion: a plain vertical `ScrollReveal` stack instead — mirrors
 * `compare-view.tsx`'s own established pattern for this exact kind of
 * desktop/mobile branch (a single component, hooks called
 * unconditionally, JSX branched on the resolved boolean) rather than a
 * CSS-hide-both approach, which `compare-view.tsx`'s own comment
 * explicitly rejects: a hidden pinned-scroll tree would still attach
 * `useScroll`'s listeners against a collapsed, zero-height layout box.
 */
export function ProductStoryScroll({ categories }: ProductStoryScrollProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const prefersReducedMotion = useReducedMotion();
  const usePinned = isDesktop && !prefersReducedMotion;

  // useScroll is always called (rules of hooks), but its `target` is only
  // ever passed when the pinned variant below actually renders and
  // attaches `containerRef` — Framer Motion throws ("Target ref is
  // defined but not hydrated") if given a ref ref that's expected to
  // attach but never does, which is exactly what happens in the fallback
  // branch where the pinned container is never rendered.
  const { scrollYProgress } = useScroll(usePinned ? { target: containerRef, offset: ["start start", "end end"] } : {});
  const x = useTransform(scrollYProgress, [0, 1], ["0%", `-${(categories.length - 1) * 100}%`]);

  if (!usePinned) {
    return (
      <div className="space-y-12">
        {categories.map((category) => (
          <ScrollReveal key={category.id}>
            <div className="relative aspect-4/3 overflow-hidden rounded-lg bg-cream">
              <Image src={category.image.src} alt={category.image.alt} fill sizes="100vw" className="object-cover" />
            </div>
            <h3 className="mt-4 text-h4 font-heading text-charcoal">{category.name}</h3>
            <p className="mt-1 text-body text-charcoal/80">{category.tagline}</p>
          </ScrollReveal>
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ height: `${categories.length * 100}vh` }}>
      <div className="sticky top-0 h-screen overflow-hidden">
        <motion.div style={{ x }} className="flex h-full">
          {categories.map((category) => (
            <div key={category.id} className="relative h-full w-screen shrink-0">
              <Image src={category.image.src} alt={category.image.alt} fill sizes="100vw" className="object-cover" />
              <div className="absolute inset-0 bg-charcoal/30" />
              <div className="absolute inset-x-0 bottom-16 text-center text-ivory">
                <h3 className="text-h2 font-heading">{category.name}</h3>
                <p className="mt-2 text-body text-ivory/90">{category.tagline}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
