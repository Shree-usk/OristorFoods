import type { Prisma } from "@/generated/prisma/client";
import { signCartToken, verifyCartCookieValue } from "@/lib/cart-token";
import { findProductById } from "@/repositories/product.repository";
import * as cartRepository from "@/repositories/cart.repository";
import type { CartItemWithProduct } from "@/repositories/cart.repository";
import {
  CartItemForbiddenError,
  CartItemNotFoundError,
  ProductUnavailableError,
  StockExceededError,
} from "@/services/cart.errors";
import { resolvePrice } from "@/services/pricing.service";
import type { CartLineItem, CartSummary } from "@/types/cart";

export const CART_COOKIE_NAME = "oristor-cart-token";

interface CartIdentityResult {
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
export async function resolveCartIdentity(
  userId: string | null,
  guestCookieValue: string | undefined,
): Promise<CartIdentityResult> {
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

async function requireAvailableProduct(productId: string, requestedQuantity: number) {
  const product = await findProductById(productId);
  if (!product || product.status !== "Published") throw new ProductUnavailableError();
  if (requestedQuantity > product.stockQuantity) throw new StockExceededError(product.stockQuantity);
  return product;
}

function toLineItem(item: CartItemWithProduct, resolvedUnitPrice: number, currency: string, priceChanged: boolean): CartLineItem {
  const primaryImage = item.product.images[0];
  const quantityCapped = item.quantity > item.product.stockQuantity;
  return {
    id: item.id,
    productId: item.product.id,
    productName: item.product.name,
    productSlug: item.product.slug,
    imageSrc: primaryImage?.url ?? "",
    imageAlt: primaryImage?.altText ?? item.product.name,
    quantity: item.quantity,
    unitPrice: resolvedUnitPrice,
    currency,
    lineTotal: Math.round(resolvedUnitPrice * item.quantity * 100) / 100,
    rewardPointsEarned: item.product.rewardPoints * item.quantity,
    priceChanged,
    unavailable: item.product.status !== "Published",
    quantityCapped,
    availableQuantity: item.product.stockQuantity,
  };
}

/**
 * Re-resolves the live price for every line, flags the ones that moved
 * since the stored snapshot, THEN overwrites the snapshot — so the
 * returned totals are always current (never stale) while the caller still
 * sees a one-time notice for exactly the read where it changed. See
 * design spec decision #6.
 */
async function buildSummary(cartId: string, items: CartItemWithProduct[]): Promise<CartSummary> {
  const lineItems: CartLineItem[] = [];
  for (const item of items) {
    const resolved = await resolvePrice({ productId: item.productId, customerGroup: "Retail", quantity: item.quantity });
    const liveUnitPrice = resolved?.price.toNumber() ?? item.unitPriceSnapshot.toNumber();
    const currency = resolved?.currency ?? "LKR";
    const priceChanged = liveUnitPrice !== item.unitPriceSnapshot.toNumber();
    if (priceChanged) {
      await cartRepository.updateCartItemSnapshot(item.id, liveUnitPrice.toFixed(2));
    }
    lineItems.push(toLineItem(item, liveUnitPrice, currency, priceChanged));
  }

  return {
    items: lineItems,
    itemCount: lineItems.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: Math.round(lineItems.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100,
    currency: lineItems[0]?.currency ?? "LKR",
    rewardPointsEarned: lineItems.reduce((sum, item) => sum + item.rewardPointsEarned, 0),
  };
}

export async function getCart(userId: string | null, guestCookieValue: string | null | undefined): Promise<CartSummary> {
  const { cart } = await resolveCartIdentity(userId, guestCookieValue ?? undefined);
  const items = await cartRepository.listCartItemsWithProduct(cart.id);
  return buildSummary(cart.id, items);
}

export async function addItem(
  userId: string | null,
  guestCookieValue: string | null | undefined,
  productId: string,
  quantity: number,
): Promise<CartIdentityResult> {
  const identity = await resolveCartIdentity(userId, guestCookieValue ?? undefined);
  const existingItem = await cartRepository.listCartItemsWithProduct(identity.cart.id).then((items) => items.find((i) => i.productId === productId));
  const totalRequested = (existingItem?.quantity ?? 0) + quantity;

  const product = await requireAvailableProduct(productId, totalRequested);
  const resolved = await resolvePrice({ productId, customerGroup: "Retail", quantity: totalRequested });
  const unitPrice = resolved?.price.toFixed(2) ?? "0.00";

  await cartRepository.upsertCartItem(identity.cart.id, product.id, quantity, unitPrice);
  return identity;
}

async function requireOwnCartItem(userId: string | null, guestCookieValue: string | null | undefined, itemId: string) {
  const { cart } = await resolveCartIdentity(userId, guestCookieValue ?? undefined);
  const item = await cartRepository.findCartItemById(itemId);
  if (!item) throw new CartItemNotFoundError();
  if (item.cartId !== cart.id) throw new CartItemForbiddenError();
  return item;
}

export async function updateItemQuantity(
  userId: string | null,
  guestCookieValue: string | null | undefined,
  itemId: string,
  quantity: number,
): Promise<void> {
  const item = await requireOwnCartItem(userId, guestCookieValue, itemId);
  await requireAvailableProduct(item.productId, quantity);
  const resolved = await resolvePrice({ productId: item.productId, customerGroup: "Retail", quantity });
  await cartRepository.updateCartItemQuantity(itemId, quantity);
  if (resolved) await cartRepository.updateCartItemSnapshot(itemId, resolved.price.toFixed(2));
}

export async function removeItem(userId: string | null, guestCookieValue: string | null | undefined, itemId: string): Promise<void> {
  await requireOwnCartItem(userId, guestCookieValue, itemId);
  await cartRepository.deleteCartItem(itemId);
}
