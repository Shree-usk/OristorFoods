import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { ScrollReveal } from "@/components/motion";
import { Section } from "@/components/storefront/layout/section";
import { Button } from "@/components/ui/button";
import type { FoodAcademyPageSettingData } from "@/types/food-academy";

/**
 * /food-academy page hero. Visually adapts the homepage's FoodAcademyTeaser
 * (concentric rings + circular badge around the product shot) but is a
 * separate component backed by separate admin-managed data
 * (FoodAcademyPageSetting, not the homepage's TeaserSectionData) — see
 * that component's own comment for why they're deliberately not shared.
 */
export function FoodAcademyHero({ data }: { data: FoodAcademyPageSettingData }) {
  return (
    <Section className="bg-beige">
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <ScrollReveal>
          <p className="text-small font-medium tracking-wide text-chilli uppercase">{data.heroEyebrow}</p>
          <h1 className="mt-3 text-h1 font-heading text-charcoal">{data.heroHeading}</h1>
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
          <div className="relative mx-auto aspect-square w-full max-w-md">
            <div className="absolute inset-0 rounded-full border border-gold-light" aria-hidden="true" />
            <div className="absolute inset-8 rounded-full border border-gold-light/70" aria-hidden="true" />
            <div className="absolute inset-12 flex items-center justify-center overflow-hidden rounded-lg bg-cream shadow-xl">
              {data.heroImageUrl && (
                <div className="relative h-full w-full">
                  <Image src={data.heroImageUrl} alt={data.heroImageAlt} fill sizes="(min-width: 1024px) 28vw, 70vw" className="object-contain p-8" />
                </div>
              )}
            </div>
            {data.heroBadgeText && (
              <div className="absolute -right-2 bottom-4 flex aspect-square w-28 items-center justify-center rounded-full bg-cream p-3 text-center shadow-lg sm:w-32">
                <p className="font-heading text-caption italic text-chilli">{data.heroBadgeText}</p>
              </div>
            )}
          </div>
        </ScrollReveal>
      </div>
    </Section>
  );
}
