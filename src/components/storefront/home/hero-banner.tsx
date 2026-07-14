import Image from "next/image";
import Link from "next/link";

import { ScrollReveal } from "@/components/motion";
import { fadeIn } from "@/components/motion/variants";
import { Button } from "@/components/ui/button";
import type { HeroBannerData } from "@/types/home";

/**
 * First homepage section — the page's only `<h1>`. Supports a headline,
 * subheadline, single CTA, and background image. No video support yet
 * (blueprint mentions "background image/video" — video can be added
 * later by swapping the `<Image>` for a `<video>` behind the same
 * overlay without changing this component's props).
 */
export function HeroBanner({ data }: { data: HeroBannerData }) {
  return (
    <section className="relative flex min-h-[32rem] items-center overflow-hidden bg-charcoal text-ivory sm:min-h-[36rem]">
      <Image
        src={data.imageSrc}
        alt={data.imageAlt}
        fill
        priority
        sizes="100vw"
        className="object-cover opacity-40"
      />
      <div className="relative mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <ScrollReveal variant={fadeIn} className="max-w-2xl">
          <h1 className="text-h1 font-heading sm:text-hero">{data.headline}</h1>
          <p className="mt-4 text-body text-ivory/85 sm:text-h4 sm:font-heading">{data.subheadline}</p>
          <Button size="lg" className="mt-8" nativeButton={false} render={<Link href={data.ctaHref} />}>
            {data.ctaLabel}
          </Button>
        </ScrollReveal>
      </div>
    </section>
  );
}
