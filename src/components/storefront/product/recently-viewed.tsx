"use client";

import { useEffect } from "react";

import { ProductCard } from "@/components/storefront/product/product-card";
import { useRecentlyViewedStore } from "@/lib/stores/recently-viewed-store";
import type { RecentlyViewedItem } from "@/validation/product-detail.schema";

export function TrackRecentlyViewed({ product }: { product: RecentlyViewedItem }) {
  const add = useRecentlyViewedStore((state) => state.add);

  useEffect(() => {
    add(product);
    // `product` is intentionally omitted: the caller passes a new object
    // literal every render, so including it would re-run this effect (and
    // re-add/reorder the recently-viewed entry) on every parent re-render
    // instead of only when the viewed product actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [add, product.id]);

  return null;
}

export function RecentlyViewed({ excludeProductId }: { excludeProductId: string }) {
  const items = useRecentlyViewedStore((state) => state.items).filter(
    (item) => item.id !== excludeProductId,
  );

  if (items.length === 0) return null;

  return (
    <div>
      <h2 className="text-h3 font-heading text-charcoal">Recently Viewed</h2>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <ProductCard key={item.id} product={item} />
        ))}
      </div>
    </div>
  );
}
