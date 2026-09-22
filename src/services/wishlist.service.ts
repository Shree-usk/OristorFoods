import { Prisma } from "@/generated/prisma/client";
import { findProductById } from "@/repositories/product.repository";
import * as wishlistRepository from "@/repositories/wishlist.repository";
import { toProductListItem } from "@/services/product.service";
import { resolvePricesForProducts } from "@/services/pricing.service";
import type { ProductListItem } from "@/types/product";

export async function getWishlist(userId: string): Promise<ProductListItem[]> {
  const wishlist = await wishlistRepository.findOrCreateWishlist(userId);
  const items = await wishlistRepository.listItemsWithProduct(wishlist.id);

  const resolvedPrices = await resolvePricesForProducts(
    items.map((item) => item.product.id),
    { customerGroup: "Retail" },
  );

  const result: ProductListItem[] = [];
  for (const item of items) {
    const resolved = resolvedPrices.get(item.product.id);
    // No price configured for this product — dropped from the list, same
    // convention product.service.ts's listRelatedProducts already uses
    // for the same situation (never show a priceless item as if it had one).
    if (!resolved) continue;
    result.push(toProductListItem(item.product, resolved.price.toNumber(), resolved.currency));
  }
  return result;
}

export async function addToWishlist(userId: string, productId: string): Promise<void> {
  const wishlist = await wishlistRepository.findOrCreateWishlist(userId);
  try {
    await wishlistRepository.addItem(wishlist.id, productId);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return; // already wishlisted — idempotent no-op, not an error
    }
    throw error;
  }
}

export async function removeFromWishlist(userId: string, productId: string): Promise<void> {
  const wishlist = await wishlistRepository.findOrCreateWishlist(userId);
  await wishlistRepository.removeItem(wishlist.id, productId);
}

/**
 * Merges a guest (localStorage) wishlist into the user's server-side one
 * on login. Runs once per login, with a small, bounded product list (the
 * merge API caps input at 200 ids — see wishlist.schema.ts) — sequential
 * per-id lookups here are intentional and fine at that scale; this is not
 * a listing endpoint that needs resolvePricesForProducts-style bulk
 * fetching.
 */
export async function mergeGuestWishlist(userId: string, productIds: string[]): Promise<void> {
  if (productIds.length === 0) return;

  const wishlist = await wishlistRepository.findOrCreateWishlist(userId);
  const uniqueIds = [...new Set(productIds)];
  const existingIds = new Set(await wishlistRepository.findExistingProductIds(wishlist.id, uniqueIds));
  const candidateIds = uniqueIds.filter((id) => !existingIds.has(id));

  for (const productId of candidateIds) {
    const product = await findProductById(productId);
    if (!product || product.status !== "Published") continue;
    await wishlistRepository.addItem(wishlist.id, productId);
  }
}
