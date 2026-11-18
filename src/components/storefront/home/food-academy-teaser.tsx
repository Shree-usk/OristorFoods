import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { ScrollReveal } from "@/components/motion";
import { Section } from "@/components/storefront/layout/section";
import { Button } from "@/components/ui/button";
import type { TeaserSectionData } from "@/types/home";

/**
 * Homepage Food Academy teaser. Unlike the plain TeaserSection layout
 * (still used by Rewards Club), this is a bespoke, more editorial
 * treatment — concentric rings and a circular "did you know" badge behind
 * the product shot — matching the brand's Food Academy visual identity.
 */
export function FoodAcademyTeaser({ data }: { data: TeaserSectionData }) {
  return (
    <Section className="bg-beige">
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <ScrollReveal>
          <p className="text-small font-medium tracking-wide text-chilli uppercase">{data.eyebrow}</p>
          <h2 className="mt-3 text-h1 font-heading text-charcoal">{data.headline}</h2>
          <p className="mt-4 max-w-md text-body text-charcoal/80">{data.description}</p>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button nativeButton={false} render={<Link href={data.ctaHref} />}>
              {data.ctaLabel}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
            {data.secondaryCtaLabel && data.secondaryCtaHref && (
              <Link
                href={data.secondaryCtaHref}
                className="text-small font-medium text-charcoal underline underline-offset-4 hover:text-chilli"
              >
                {data.secondaryCtaLabel}
              </Link>
            )}
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <div className="relative mx-auto aspect-square w-full max-w-md">
            <div className="absolute inset-0 rounded-full border border-gold-light" aria-hidden="true" />
            <div className="absolute inset-8 rounded-full border border-gold-light/70" aria-hidden="true" />
            <div className="absolute inset-12 flex items-center justify-center overflow-hidden rounded-lg bg-cream shadow-xl">
              <div className="relative h-full w-full">
                <Image
                  src={data.imageSrc}
                  alt={data.imageAlt}
                  fill
                  sizes="(min-width: 1024px) 28vw, 70vw"
                  className="object-contain p-8"
                />
              </div>
            </div>
            {data.badgeText && (
              <div className="absolute -right-2 bottom-4 flex aspect-square w-28 items-center justify-center rounded-full bg-cream p-3 text-center shadow-lg sm:w-32">
                <p className="font-heading text-caption italic text-chilli">{data.badgeText}</p>
              </div>
            )}
          </div>
        </ScrollReveal>
      </div>
    </Section>
  );
}
