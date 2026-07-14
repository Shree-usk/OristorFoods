import Image from "next/image";
import Link from "next/link";

import { ScrollReveal } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/storefront/layout/section";
import type { TeaserSectionData } from "@/types/home";

/**
 * Shared layout for the three structurally-identical marketing teaser
 * sections (Food Academy, Export Solutions, Rewards Club) — each gets
 * its own thin wrapper component (per this story's AC) that renders
 * this primitive with its own fixture data + heading, rather than three
 * near-duplicate implementations.
 */
export function TeaserSection({
  data,
  reverse = false,
  className,
}: {
  data: TeaserSectionData;
  reverse?: boolean;
  className?: string;
}) {
  return (
    <Section className={className}>
      <div
        className={`grid grid-cols-1 items-center gap-8 lg:grid-cols-2 ${reverse ? "lg:[&>*:first-child]:order-2" : ""}`}
      >
        <ScrollReveal>
          <div className="relative aspect-4/3 overflow-hidden rounded-lg bg-cream">
            <Image
              src={data.imageSrc}
              alt={data.imageAlt}
              fill
              sizes="(min-width: 1024px) 50vw, 90vw"
              className="object-contain p-8"
            />
          </div>
        </ScrollReveal>
        <ScrollReveal delay={0.1}>
          <p className="text-small font-medium tracking-wide text-chilli uppercase">{data.eyebrow}</p>
          <h2 className="mt-2 text-h2 font-heading text-charcoal">{data.headline}</h2>
          <p className="mt-4 text-body text-charcoal/80">{data.description}</p>
          <Button className="mt-6" nativeButton={false} render={<Link href={data.ctaHref} />}>
            {data.ctaLabel}
          </Button>
        </ScrollReveal>
      </div>
    </Section>
  );
}
