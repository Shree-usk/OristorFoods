import Image from "next/image";
import Link from "next/link";

import { ScrollReveal } from "@/components/motion";

export interface ExportCollectionCardData {
  id: string;
  name: string;
  slug: string;
  image: string;
  description: string | null;
}

/** Links into the catalogue section below with the collection pre-filtered — never into the retail /products/collections/[slug] listing, which is the wrong audience for a B2B buyer. */
export function ExportCollectionsGrid({ collections }: { collections: ExportCollectionCardData[] }) {
  if (collections.length === 0) return null;

  return (
    <div>
      <h2 className="text-h2 font-heading text-charcoal">Explore Our Collections</h2>
      <p className="mt-2 max-w-2xl text-body text-charcoal/80">
        Browse by collection to find the products best suited to your market, then add them to your selection below.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {collections.map((collection, index) => (
          <ScrollReveal key={collection.id} delay={index * 0.05}>
            <Link
              href={`/export?collection=${collection.slug}#catalogue`}
              scroll={false}
              className="group relative block overflow-hidden rounded-lg bg-charcoal text-ivory"
            >
              <div className="relative aspect-4/3">
                <Image
                  src={collection.image}
                  alt={collection.name}
                  fill
                  sizes="(min-width: 640px) 33vw, 90vw"
                  className="object-cover opacity-60 transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-charcoal/90 via-charcoal/30 to-transparent" />
              </div>
              <div className="absolute inset-x-0 bottom-0 p-5">
                <p className="text-h4 font-heading">{collection.name}</p>
                {collection.description ? <p className="mt-1 text-small text-ivory/80">{collection.description}</p> : null}
              </div>
            </Link>
          </ScrollReveal>
        ))}
      </div>
    </div>
  );
}
