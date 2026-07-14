import Image from "next/image";
import Link from "next/link";

import { ScrollReveal } from "@/components/motion";
import { Section } from "@/components/storefront/layout/section";
import type { CollectionCardData } from "@/types/home";

export function ProductCollections({ collections }: { collections: CollectionCardData[] }) {
  return (
    <Section>
      <h2 className="text-h2 font-heading text-charcoal">Product Collections</h2>
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {collections.map((collection, index) => (
          <ScrollReveal key={collection.id} delay={index * 0.05}>
            <Link
              href={collection.href}
              className="group relative block overflow-hidden rounded-lg bg-charcoal text-ivory"
            >
              <div className="relative aspect-4/3">
                <Image
                  src={collection.imageSrc}
                  alt={collection.imageAlt}
                  fill
                  sizes="(min-width: 640px) 33vw, 90vw"
                  className="object-cover opacity-60 transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="absolute inset-x-0 bottom-0 p-5">
                <p className="text-h4 font-heading">{collection.name}</p>
                <p className="mt-1 text-small text-ivory/80">{collection.description}</p>
              </div>
            </Link>
          </ScrollReveal>
        ))}
      </div>
    </Section>
  );
}
