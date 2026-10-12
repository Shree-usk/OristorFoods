import type { Prisma } from "@/generated/prisma/client";
import { signCartToken, verifyCartCookieValue } from "@/lib/cart-token";
import { getOrCreateSessionId } from "@/lib/recommendation-session";
import { findProductById } from "@/repositories/product.repository";
import * as cartRepository from "@/repositories/cart.repository";
import { ProductUnavailableError, StockExceededError } from "@/services/cart.errors";
import { trackInteraction } from "@/services/recommendation.service";

/**
 * Cart-identity primitives shared by cart.service.ts and bundle.service.ts
 * (Story 2). Split out of cart.service.ts specifically to avoid a circular
 * import: bundle.service.ts needs resolveCartIdentity/requireAvailableProduct,
 * and cart.service.ts needs to call into bundle.service.ts's
 * resolveBundleInstancePrices from buildSummary — two files can't import
 * each other, so the primitives both of them need live at a lower layer.
 * Same reasoning rewards.service.ts's own header comment documents for why
 * IT reads rewards.repository.ts directly instead of cart.service.ts.
 *
 * cart.service.ts re-exports CART_COOKIE_NAME/resolveCartIdentity so every
 * existing external import site (route handlers, cart-cookie.ts, etc.)
 * keeps working unchanged.
 */

export const CART_COOKIE_NAME = "oristor-cart-token";

export interface CartIdentityResult {
  cart: Prisma.CartGetPayload<object>;
  /** Set only when a brand-new guest cart was just created — the caller (a route handler) must Set-Cookie this. */
  newCookieValue: string | null;
}

/**
 * Resolves which Cart a request's identity maps to, creating one if
 * needed. An authenticated userId always wins over a guest cookie (a
 * logged-in visitor's cart is their account cart, never a lingering guest
 * one — the guest cart, if any, is handled by the merge flow, Task 6).
 * A cookie that fails signature verification is treated exactly like no
 * cookie at all: a fresh guest cart is created, never an error.
 */
export async function resolveCartIdentity(userId: string | null, guestCookieValue: string | undefined): Promise<CartIdentityResult> {
  if (userId) {
    const existing = await cartRepository.findCartByUserId(userId);
    if (existing) return { cart: existing, newCookieValue: null };
    const created = await cartRepository.createUserCart(userId);
    return { cart: created, newCookieValue: null };
  }

  const verifiedToken = verifyCartCookieValue(guestCookieValue);
  if (verifiedToken) {
    const existing = await cartRepository.findCartByGuestToken(verifiedToken);
    if (existing) return { cart: existing, newCookieValue: null };
    // Verified token with no matching row (e.g. the row was deleted by a
    // merge) — fall through to creating a fresh guest cart below.
  }

  const { token, cookieValue } = signCartToken();
  const created = await cartRepository.createGuestCart(token);
  return { cart: created, newCookieValue: cookieValue };
}

export async function requireAvailableProduct(productId: string, requestedQuantity: number) {
  const product = await findProductById(productId);
  if (!product || product.status !== "Published" || !product.inStock) throw new ProductUnavailableError();
  if (requestedQuantity > product.stockQuantity) throw new StockExceededError(product.stockQuantity);
  return product;
}

export async function recordAddToCartInteraction(userId: string | null, productId: string): Promise<void> {
  const sessionId = userId ? null : await getOrCreateSessionId();
  await trackInteraction({ customerId: userId, sessionId, productId, eventType: "AddToCart" });
}
