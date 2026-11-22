import type { ProductDetailPromiseAttribute } from "@/services/product.service";

interface ProductPromiseSectionProps {
  enabled: boolean;
  heading: string | null;
  attributes: ProductDetailPromiseAttribute[];
}

export function ProductPromiseSection({ enabled, heading, attributes }: ProductPromiseSectionProps) {
  if (!enabled || attributes.length === 0) return null;

  return (
    <div className="rounded-2xl border border-gold/30 bg-gradient-to-b from-gold-light/25 via-cream to-cream px-6 py-10 sm:px-10">
      <h2 className="text-center text-h3 font-heading text-chilli">{heading ?? "Good Food. Thoughtfully Made."}</h2>
      <div className="mt-8 grid grid-cols-1 gap-8 divide-y divide-gold/20 sm:grid-cols-2 sm:gap-6 sm:divide-y-0 lg:grid-cols-4">
        {attributes.map((attribute, index) => (
          <div key={`${attribute.heading}-${index}`} className="flex flex-col items-center pt-8 text-center first:pt-0 sm:pt-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- admin-typed/Media-Library URL, arbitrary domain */}
            <img src={attribute.imageUrl} alt={attribute.imageAlt ?? ""} className="size-12 rounded-full object-cover" />
            <h3 className="mt-3 text-small font-semibold text-charcoal">{attribute.heading}</h3>
            {attribute.description && <p className="mt-1 text-caption text-charcoal/70">{attribute.description}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
