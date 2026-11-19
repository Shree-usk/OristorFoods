import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { ScrollReveal } from "@/components/motion";
import { Section } from "@/components/storefront/layout/section";
import { FoodAcademyHeroVisual } from "@/components/storefront/food-academy/food-academy-hero-visual";
import { Button } from "@/components/ui/button";
import type { FoodAcademyPageSettingData } from "@/types/food-academy";

/**
 * Homepage Food Academy teaser. Reads the same admin-managed
 * FoodAcademyPageSetting the /food-academy hub's own hero (FoodAcademyHero)
 * reads — editing Admin > Food Academy > Page settings now updates both
 * places at once, rather than this section being stuck on fixture copy.
 * Shares its image/badge treatment with FoodAcademyHero via
 * FoodAcademyHeroVisual; stays a separate component only because this
 * heading is an h2 (the homepage's h1 is the Hero Banner), not an h1.
 */
export function FoodAcademyTeaser({ data }: { data: FoodAcademyPageSettingData }) {
  return (
    <Section className="bg-beige">
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <ScrollReveal>
          <p className="text-small font-medium tracking-wide text-chilli uppercase">{data.heroEyebrow}</p>
          <h2 className="mt-3 text-h1 font-heading text-charcoal">{data.heroHeading}</h2>
          <p className="mt-4 max-w-md text-body text-charcoal/80">{data.heroDescription}</p>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button nativeButton={false} render={<Link href={data.heroPrimaryCtaHref} />}>
              {data.heroPrimaryCtaLabel}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
            {data.heroSecondaryCtaLabel && data.heroSecondaryCtaHref && (
              <Link
                href={data.heroSecondaryCtaHref}
                className="text-small font-medium text-charcoal underline underline-offset-4 hover:text-chilli"
              >
                {data.heroSecondaryCtaLabel}
              </Link>
            )}
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <FoodAcademyHeroVisual imageUrl={data.heroImageUrl} imageAlt={data.heroImageAlt} badgeText={data.heroBadgeText} />
        </ScrollReveal>
      </div>
    </Section>
  );
}
