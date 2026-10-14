import type { ProductDetailInspirationCard } from "@/services/product.service";

export function InspirationCards({ cards }: { cards: ProductDetailInspirationCard[] }) {
  if (cards.length === 0) return null;

  return (
    <div>
      <h2 className="text-h3 font-heading text-charcoal">A little inspiration for your table</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <div key={card.id} className="flex gap-3 rounded-lg border border-charcoal/10 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- admin-typed/Media-Library URL, arbitrary domain, not worth configuring next/image's remote-pattern allowlist for */}
            <img src={card.imageUrl} alt={card.imageAlt ?? ""} className="h-25 w-20 shrink-0 rounded-md object-cover" />
            <div>
              <h3 className="text-small font-semibold text-charcoal">{card.title}</h3>
              {card.description && <p className="mt-1 text-caption text-charcoal/70">{card.description}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
