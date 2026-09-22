import type { ProductListItem } from "@/types/product";

/**
 * Shared client-side wrapper around the wishlist HTTP API — STORY-013.
 *
 * Both `useWishlist` (the toggle button hook) and `WishlistView` (the
 * account page) talk to the same three endpoints, so the fetch calls live
 * here rather than being duplicated in each. Every function checks
 * `response.ok` and throws on a non-2xx, so callers (TanStack Query
 * mutations, or an explicit `.catch()`) can surface the failure instead of
 * silently treating a 401/500 as success.
 */

function assertOk(response: Response, message: string): void {
  if (!response.ok) {
    throw new Error(`${message} (${response.status})`);
  }
}

/** GET /api/wishlist — the signed-in user's wishlist. */
export async function fetchWishlist(): Promise<ProductListItem[]> {
  const response = await fetch("/api/wishlist");
  assertOk(response, "Failed to load wishlist");
  const body: { items: ProductListItem[] } = await response.json();
  return body.items;
}

/** GET /api/products/by-ids — hydrates guest (localStorage) wishlist ids. */
export async function fetchProductsByIds(ids: string[]): Promise<ProductListItem[]> {
  if (ids.length === 0) return [];
  const response = await fetch(`/api/products/by-ids?ids=${ids.join(",")}`);
  assertOk(response, "Failed to load wishlist");
  const body: { items: ProductListItem[] } = await response.json();
  return body.items;
}

/** POST /api/wishlist — adds a product to the signed-in user's wishlist. */
export async function addWishlistItem(productId: string): Promise<void> {
  const response = await fetch("/api/wishlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId }),
  });
  assertOk(response, "Failed to add to wishlist");
}

/** DELETE /api/wishlist/:productId — removes a product from the wishlist. */
export async function removeWishlistItem(productId: string): Promise<void> {
  const response = await fetch(`/api/wishlist/${productId}`, { method: "DELETE" });
  assertOk(response, "Failed to remove from wishlist");
}
