import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { ScrollReveal } from "@/components/motion";
import { storyCtaContent } from "@/lib/story-content";

/** STORY-073. Closing section — the real ORISTOR tagline ("Feel the Difference"), not invented. */
export function StoryCTA() {
  return (
    <ScrollReveal>
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-h1 font-heading text-charcoal">{storyCtaContent.headline}</h2>
        <p className="mt-4 text-body text-charcoal/80">{storyCtaContent.subcopy}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link href={storyCtaContent.primaryHref} className={buttonVariants({ size: "lg" })}>
            {storyCtaContent.primaryLabel}
          </Link>
          <Link href={storyCtaContent.secondaryHref} className={buttonVariants({ variant: "outline", size: "lg" })}>
            {storyCtaContent.secondaryLabel}
          </Link>
        </div>
      </div>
    </ScrollReveal>
  );
}
