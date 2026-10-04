"use client";

import { useEffect, useRef } from "react";

import { ProductCard } from "@/components/storefront/product/product-card";
import type { ProductListItem } from "@/types/product";
import type { RecommendationPlacementValue } from "@/lib/api/recommendations-client";
import { trackRecommendationEvent } from "@/lib/api/recommendations-client";

/**
 * STORY-060. Reused across Homepage/PDP/Cart with a `placement` prop —
 * fires an Impression once per product the first time its card enters
 * the viewport, and a Click on navigation. Never blocks navigation on
 * the tracking call (fire-and-forget, errors swallowed).
 */
export function RecommendationRail({
  title,
  products,
  placement,
  emptyFallback = null,
}: {
  title: string;
  products: ProductListItem[];
  placement: RecommendationPlacementValue;
  emptyFallback?: React.ReactNode;
}) {
  const trackedImpressions = useRef(new Set<string>());
  const cardRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    trackedImpressions.current = new Set();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const productId = entry.target.getAttribute("data-product-id");
          if (!productId || trackedImpressions.current.has(productId)) continue;
          trackedImpressions.current.add(productId);
          trackRecommendationEvent({ placement, productId, action: "Impression" });
        }
      },
      { threshold: 0.5 },
    );
    for (const node of cardRefs.current.values()) observer.observe(node);
    return () => observer.disconnect();
  }, [products, placement]);

  if (products.length === 0) return emptyFallback;

  return (
    <div>
      <h2 className="text-h3 font-heading text-charcoal">{title}</h2>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <div
            key={product.id}
            data-product-id={product.id}
            ref={(node) => {
              if (node) cardRefs.current.set(product.id, node);
              else cardRefs.current.delete(product.id);
            }}
            onClickCapture={() => trackRecommendationEvent({ placement, productId: product.id, action: "Click" })}
          >
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </div>
  );
}
