import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { ScrollReveal } from "@/components/motion";
import type { StoryCtaContent } from "@/types/story";

/** STORY-073. Closing section — the real ORISTOR tagline ("Feel the Difference"), not invented. */
export function StoryCTA({ headline, subcopy, primaryLabel, primaryHref, secondaryLabel, secondaryHref }: StoryCtaContent) {
  return (
    <ScrollReveal>
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-h1 font-heading text-charcoal">{headline}</h2>
        <p className="mt-4 text-body text-charcoal/80">{subcopy}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link href={primaryHref} className={buttonVariants({ size: "lg" })}>
            {primaryLabel}
          </Link>
          <Link href={secondaryHref} className={buttonVariants({ variant: "outline", size: "lg" })}>
            {secondaryLabel}
          </Link>
        </div>
      </div>
    </ScrollReveal>
  );
}
