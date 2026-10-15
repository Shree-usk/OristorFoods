import type { ProductDetailFeaturedItem } from "@/services/product.service";

/**
 * "Items Featured in This Collection" — plain photo/title/description
 * cards, deliberately not linked to a real Product or Collection (see
 * ProductFeaturedItem's schema comment). Up to 4 per row, equal gaps —
 * matches the admin's own max-8 cap at two full rows.
 */
export function FeaturedItems({ items }: { items: ProductDetailFeaturedItem[] }) {
  if (items.length === 0) return null;

  return (
    <div>
      <h2 className="text-h3 font-heading text-charcoal text-center">Items Featured in This Collection</h2>
      <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
        {items.map((item) => (
          <div key={item.id}>
            {/* eslint-disable-next-line @next/next/no-img-element -- admin-typed/Media-Library URL, arbitrary domain, not worth configuring next/image's remote-pattern allowlist for */}
            <img src={item.imageUrl} alt={item.imageAlt ?? ""} className="aspect-[3/4] w-full rounded-lg object-cover" />
            <h3 className="mt-3 text-center text-h4 font-heading text-charcoal">{item.title}</h3>
            {item.description && <p className="mt-1 text-center text-small text-charcoal/70">{item.description}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
