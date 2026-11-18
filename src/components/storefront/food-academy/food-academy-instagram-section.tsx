import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { ScrollReveal } from "@/components/motion";
import { Section } from "@/components/storefront/layout/section";
import type { InstagramPostData } from "@/types/home";

/**
 * /food-academy's Instagram showcase. Sources the same live, auto-synced
 * feed the homepage's InstagramGallery uses (getRecentPostsForStorefront)
 * — no per-page curation layer, per the explicitly confirmed scope
 * decision. A separate component rather than a variant of InstagramGallery
 * because this section wants a different grid (5/3/2 columns, not 6/3) and
 * noticeably larger, edge-to-edge tiles — InstagramGallery itself is left
 * untouched.
 */
export function FoodAcademyInstagramSection({
  heading,
  description,
  ctaLabel,
  ctaHref,
  posts,
}: {
  heading: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  posts: InstagramPostData[];
}) {
  if (posts.length === 0) return null;

  return (
    <Section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <ScrollReveal>
          <h2 className="text-h2 font-heading text-charcoal">{heading}</h2>
          {description && <p className="mt-2 max-w-xl text-body text-charcoal/70">{description}</p>}
        </ScrollReveal>
        {ctaLabel && ctaHref && (
          <Link href={ctaHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-small font-medium text-chilli hover:underline">
            {ctaLabel}
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </div>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        {posts.map((post, index) => (
          <ScrollReveal key={post.id} delay={index * 0.04}>
            <a href={post.href} target="_blank" rel="noopener noreferrer" className="group relative block aspect-square overflow-hidden rounded-lg bg-beige">
              <Image
                src={post.imageSrc}
                alt={post.imageAlt}
                fill
                sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </a>
          </ScrollReveal>
        ))}
      </div>
    </Section>
  );
}
