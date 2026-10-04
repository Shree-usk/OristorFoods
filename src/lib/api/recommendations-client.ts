import type { ProductListItem } from "@/types/product";

/** STORY-060. Client-side wrapper around /api/recommendations/* — mirrors wishlist-client.ts's exact shape. */

export type RecommendationPlacementValue = "Homepage" | "Pdp" | "Cart";
export type RecommendationActionValue = "Impression" | "Click" | "AddToCart";

function assertOk(response: Response, message: string): void {
  if (!response.ok) throw new Error(`${message} (${response.status})`);
}

export interface HomepageRecommendationsResult {
  products: ProductListItem[];
  personalized: boolean;
}

export async function fetchHomepageRecommendations(): Promise<HomepageRecommendationsResult> {
  const response = await fetch("/api/recommendations/homepage");
  assertOk(response, "Failed to load recommendations");
  return response.json();
}

export async function fetchCartRecommendations(productIds: string[]): Promise<ProductListItem[]> {
  if (productIds.length === 0) return [];
  const response = await fetch("/api/recommendations/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productIds }),
  });
  assertOk(response, "Failed to load cart recommendations");
  const body: { products: ProductListItem[] } = await response.json();
  return body.products;
}

/** Fire-and-forget — never throws, a tracking failure must never surface to the shopper. */
export function trackRecommendationEvent(input: { placement: RecommendationPlacementValue; productId: string; action: RecommendationActionValue }): void {
  fetch("/api/recommendations/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    keepalive: true,
  }).catch(() => {});
}
