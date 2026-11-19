"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

import { hoverLift } from "@/components/motion";

/**
 * Shared hero image treatment for both the homepage's FoodAcademyTeaser and
 * the /food-academy hub's own FoodAcademyHero — previously each hand-rolled
 * its own near-identical concentric-ring-circle + plain square box, which
 * read as flat and dated. This replaces that with a soft warm gradient glow
 * backdrop, a generously-rounded image card that lifts slightly on hover
 * (reusing the shared `hoverLift` micro-interaction), and a bold, rotated
 * "stamp" badge with real contrast (solid chilli fill, not a faint cream
 * circle on a cream/beige page).
 */
export function FoodAcademyHeroVisual({
  imageUrl,
  imageAlt,
  badgeText,
}: {
  imageUrl: string | null;
  imageAlt: string | null;
  badgeText?: string | null;
}) {
  if (!imageUrl) return null;

  return (
    <div className="relative mx-auto aspect-square w-full max-w-md">
      <div
        className="absolute inset-0 rounded-full bg-gradient-to-br from-gold-light/60 via-chilli/15 to-transparent blur-2xl"
        aria-hidden="true"
      />
      <motion.div {...hoverLift} className="absolute inset-6 overflow-hidden rounded-[2rem] bg-cream shadow-xl sm:inset-10">
        <div className="relative h-full w-full">
          <Image src={imageUrl} alt={imageAlt ?? ""} fill sizes="(min-width: 1024px) 28vw, 70vw" className="object-contain p-8" />
        </div>
      </motion.div>
      {badgeText && (
        <div className="absolute -right-3 bottom-2 flex aspect-square w-32 -rotate-6 flex-col items-center justify-center gap-1 rounded-full bg-chilli p-4 text-center shadow-lg sm:w-36">
          <Sparkles className="size-4 text-cream" aria-hidden="true" />
          <p className="font-heading text-caption font-semibold italic leading-snug text-cream">{badgeText}</p>
        </div>
      )}
    </div>
  );
}
