import type { Prisma } from "@/generated/prisma/client";
import * as productVariantRepository from "@/repositories/product-variant.repository";
import { ProductUnavailableError, StockExceededError } from "@/services/cart.errors";

/**
 * The customer-facing (not admin) read path for ProductVariant — the
 * variant analogue of pricing.service.ts's role relative to product-
 * admin.service.ts's pricing CRUD: admin writes variant rows via
 * product-admin.service.ts, this file resolves them for cart/checkout.
 *
 * Deliberately NOT wired into pricing.service.ts's 5-tier resolution —
 * a variant's price is just `promoPrice ?? price`, no campaign/customer-
 * group/volume-discount tiers apply at the variant level (see the
 * Product Variants story's design decision).
 */

export type AvailableVariant = Prisma.ProductVariantGetPayload<object>;

export async function requireAvailableVariant(variantId: string, requestedQuantity: number): Promise<AvailableVariant> {
  const variant = await productVariantRepository.findVariantById(variantId);
  if (!variant || !variant.isActive || !variant.inStock) throw new ProductUnavailableError();
  if (requestedQuantity > variant.stockQuantity) throw new StockExceededError(variant.stockQuantity);
  return variant;
}

export function resolveVariantPrice(variant: Pick<AvailableVariant, "price" | "promoPrice" | "currency">): { price: number; currency: string } {
  const price = (variant.promoPrice ?? variant.price).toNumber();
  return { price, currency: variant.currency };
}
