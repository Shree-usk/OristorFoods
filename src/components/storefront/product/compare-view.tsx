"use client";

import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useCompareStore } from "@/lib/stores/compare-store";
import type { CompareItem } from "@/services/product.service";

function formatPrice(price: number, currency: string) {
  return `${currency} ${price.toLocaleString()}`;
}

const ATTRIBUTE_ROWS: Array<{ label: string; render: (item: CompareItem) => React.ReactNode }> = [
  { label: "Price", render: (item) => formatPrice(item.price, item.currency) },
  { label: "Brand", render: (item) => item.brandName ?? "—" },
  { label: "Rating", render: (item) => (item.rating !== null ? `${item.rating} (${item.reviewCount})` : "—") },
  {
    label: "Calories",
    render: (item) => (item.nutrition ? `${item.nutrition.calories} kcal` : "—"),
  },
  {
    label: "Protein",
    render: (item) => (item.nutrition ? `${item.nutrition.protein}g` : "—"),
  },
  {
    label: "Ingredients",
    render: (item) => (item.ingredients.length > 0 ? item.ingredients.map((i) => i.name).join(", ") : "—"),
  },
  {
    label: "Allergens",
    render: (item) => (item.allergenNames.length > 0 ? item.allergenNames.join(", ") : "None"),
  },
  {
    label: "Certifications",
    render: (item) => (item.certificationNames.length > 0 ? item.certificationNames.join(", ") : "—"),
  },
];

export function CompareView({ items: initialItems }: { items: CompareItem[] }) {
  const router = useRouter();
  const removeFromStore = useCompareStore((state) => state.remove);
  // Table for desktop, stacked cards for mobile. Branching in JS (rather than
  // rendering both and toggling visibility with `hidden`/`md:table` classes)
  // means only one layout is ever mounted — no duplicate accessible names or
  // duplicate interactive controls for the same product.
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // Locally-removed ids, layered over the `items` prop so a remove updates
  // the view immediately without waiting on `router.replace` below (which
  // keeps the URL's `ids` param — and eventually the server-refetched
  // `items` prop, on the next navigation — in sync, but that round-trip
  // shouldn't gate the visible removal). Derived during render rather than
  // mirrored into state via an effect.
  const [removedIds, setRemovedIds] = useState<ReadonlySet<string>>(() => new Set());
  const items = initialItems.filter((item) => !removedIds.has(item.id));

  function handleRemove(productId: string) {
    removeFromStore(productId);
    const remainingIds = items.filter((item) => item.id !== productId).map((item) => item.id);
    setRemovedIds((current) => new Set(current).add(productId));
    router.replace(remainingIds.length > 0 ? `/products/compare?ids=${remainingIds.join(",")}` : "/products/compare");
  }

  if (items.length < 2) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-h3 text-charcoal">Add more products to compare</h1>
        <p className="mt-2 text-body text-charcoal/80">Select at least 2 products to see a side-by-side comparison.</p>
        <Link href="/products" className={buttonVariants({ className: "mt-6" })}>
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-h3 text-charcoal">Compare Products</h1>

      {isDesktop ? (
        <table className="mt-6 w-full border-collapse">
          <thead>
            <tr>
              <th className="w-32" />
              {items.map((item) => (
                <th key={item.id} className="p-3 text-left align-top">
                  <div className="relative">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="absolute top-0 right-0"
                      aria-label={`Remove ${item.name}`}
                      onClick={() => handleRemove(item.id)}
                    >
                      <X className="size-4" />
                    </Button>
                    <Link href={`/products/${item.slug}`} className="block">
                      <div className="relative aspect-square size-24 overflow-hidden rounded-lg bg-cream">
                        <Image src={item.imageSrc} alt={item.imageAlt} fill sizes="96px" className="object-contain p-2" />
                      </div>
                      <p className="mt-2 font-medium text-charcoal">{item.name}</p>
                    </Link>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ATTRIBUTE_ROWS.map((row) => (
              <tr key={row.label} className="border-t border-border">
                <th className="p-3 text-left text-caption font-medium text-charcoal/70">{row.label}</th>
                {items.map((item) => (
                  <td key={item.id} className="p-3 text-body text-charcoal">
                    {row.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="mt-6 space-y-6">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between">
                <Link href={`/products/${item.slug}`} className="flex items-center gap-3">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-cream">
                    <Image src={item.imageSrc} alt={item.imageAlt} fill sizes="64px" className="object-contain p-2" />
                  </div>
                  <p className="font-medium text-charcoal">{item.name}</p>
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${item.name}`}
                  onClick={() => handleRemove(item.id)}
                >
                  <X className="size-4" />
                </Button>
              </div>
              <dl className="mt-3 space-y-1">
                {ATTRIBUTE_ROWS.map((row) => (
                  <div key={row.label} className="flex justify-between text-small">
                    <dt className="text-charcoal/70">{row.label}</dt>
                    <dd className="text-charcoal">{row.render(item)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
