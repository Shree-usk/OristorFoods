import Image from "next/image";

import { ScrollReveal } from "@/components/motion";
import type { StoryHeroContent } from "@/types/story";

/** STORY-073. ~65vh cinematic hero — real ingredient photography, not stock/landscape (none exists in this project). */
export function StoryHero({ eyebrow, headline, subcopy, image }: StoryHeroContent) {
  return (
    <div className="relative flex min-h-[65vh] items-center overflow-hidden bg-charcoal">
      <div className="absolute inset-0">
        <Image src={image.src} alt={image.alt} fill priority sizes="100vw" className="object-cover opacity-40" />
      </div>
      <div className="relative mx-auto max-w-3xl px-4 py-24 text-center">
        <ScrollReveal>
          <p className="text-small font-medium tracking-wide text-gold uppercase">{eyebrow}</p>
          <h1 className="mt-3 text-hero font-heading text-ivory">{headline}</h1>
          <p className="mx-auto mt-5 max-w-xl text-body text-ivory/80">{subcopy}</p>
        </ScrollReveal>
      </div>
    </div>
  );
}
