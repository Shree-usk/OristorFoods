import type { Prisma } from "@/generated/prisma/client";
import { signCartToken, verifyCartCookieValue } from "@/lib/cart-token";
import { findProductById } from "@/repositories/product.repository";
import * as cartRepository from "@/repositories/cart.repository";
import type { CartItemWithProduct } from "@/repositories/cart.repository";
import * as rewardsRepository from "@/repositories/rewards.repository";
import {
  CartItemForbiddenError,
  CartItemNotFoundError,
  ProductUnavailableError,
  StockExceededError,
} from "@/services/cart.errors";
import { resolveDiscountForCart } from "@/services/discount.service";
import type { DiscountableLine } from "@/services/discount.service";
import { resolvePrice } from "@/services/pricing.service";
import { calculatePointsRedemption } from "@/services/rewards-calc";
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
  if (!product || product.status !== "Published" || !product.inStock) throw new ProductUnavailableError();
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
    unavailable: item.product.status !== "Published" || !item.product.inStock,
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
 *
 * STORY-029: also resolves the cart's applied coupon + any active
 * promotions on every read — discount recalculates live as the cart
 * changes for free, the same way price-change detection already does.
 * `deliveryCharge` is 0 here (delivery only resolves at checkout's
 * Delivery step, given a city) — a FreeShipping coupon/promotion shows no
 * savings yet at a plain cart read, only once a real delivery charge
 * exists to waive; `couponCode` stays set regardless, so the UI can show
 * "applied — savings shown at checkout" rather than treating it as absent.
 *
 * STORY-030: reads rewards.repository.ts + rewards-calc.ts directly for
 * the points-preview (never rewards.service.ts — that would create an
 * import cycle, since rewards.service.ts itself calls into this file's
 * getCartSummaryById for its own apply/remove-points mutations; see
 * rewards.service.ts's header comment). A guest (userId null) always
 * gets pointsBalance: 0, pointsRedemption: null — no ledger to read.
 */
async function buildSummary(cart: Prisma.CartGetPayload<object>, items: CartItemWithProduct[], userId: string | null): Promise<CartSummary> {
  const lineItems: CartLineItem[] = [];
  const discountableLines: DiscountableLine[] = [];
  for (const item of items) {
    const resolved = await resolvePrice({ productId: item.productId, customerGroup: "Retail", quantity: item.quantity });
    const liveUnitPrice = resolved?.price.toNumber() ?? item.unitPriceSnapshot.toNumber();
    const currency = resolved?.currency ?? "LKR";
    const priceChanged = liveUnitPrice !== item.unitPriceSnapshot.toNumber();
    if (priceChanged) {
      await cartRepository.updateCartItemSnapshot(item.id, liveUnitPrice.toFixed(2));
    }
    const line = toLineItem(item, liveUnitPrice, currency, priceChanged);
    lineItems.push(line);
    discountableLines.push({ productId: item.productId, categoryIds: item.product.categories.map((category) => category.id), lineTotal: line.lineTotal });
  }

  const subtotal = Math.round(lineItems.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100;
  const discount = await resolveDiscountForCart({ couponId: cart.couponId }, discountableLines, subtotal, 0, userId);

  let pointsBalance = 0;
  let pointsRedemption: { points: number; value: number } | null = null;
  if (userId) {
    const [setting, balances] = await Promise.all([rewardsRepository.getSetting(), rewardsRepository.getBalances(userId)]);
    pointsBalance = balances.spendable;
    if (cart.pointsToRedeem && cart.pointsToRedeem > 0) {
      const calc = calculatePointsRedemption({
        pointsRequested: cart.pointsToRedeem,
        spendableBalance: balances.spendable,
        pointsToCurrencyRate: setting?.pointsToCurrencyRate?.toNumber() ?? null,
        maxRedeemablePointsPerOrder: setting?.maxRedeemablePointsPerOrder ?? null,
        payableBeforePoints: Math.round((subtotal - discount.totalAmount) * 100) / 100,
      });
      if (calc.pointsToRedeem > 0) pointsRedemption = { points: calc.pointsToRedeem, value: calc.discountValue };
    }
  }

  return {
    items: lineItems,
    itemCount: lineItems.reduce((sum, item) => sum + item.quantity, 0),
    subtotal,
    currency: lineItems[0]?.currency ?? "LKR",
    rewardPointsEarned: lineItems.reduce((sum, item) => sum + item.rewardPointsEarned, 0),
    discount:
      discount.applied.length > 0
        ? { amount: discount.totalAmount, applied: discount.applied, freeShippingApplied: discount.freeShippingApplied }
        : null,
    pointsBalance,
    pointsRedemption,
    couponCode: discount.couponCode,
    couponInvalidReason: discount.couponInvalidReason,
  };
}

export async function getCart(userId: string | null, guestCookieValue: string | null | undefined): Promise<CartSummary> {
  const { cart } = await resolveCartIdentity(userId, guestCookieValue ?? undefined);
  const items = await cartRepository.listCartItemsWithProduct(cart.id);
  return buildSummary(cart, items, userId);
}

/**
 * Re-reads a cart already identified by id (STORY-029: used by
 * coupon.service.ts to return a fresh summary after mutating
 * Cart.couponId, without a second resolveCartIdentity call — that would
 * risk creating a SECOND guest cart within the same request if the
 * caller's cookie header hadn't been re-issued yet).
 */
export async function getCartSummaryById(cartId: string, userId: string | null): Promise<CartSummary> {
  const cart = await cartRepository.findCartById(cartId);
  if (!cart) throw new CartItemNotFoundError();
  const items = await cartRepository.listCartItemsWithProduct(cart.id);
  return buildSummary(cart, items, userId);
}

/**
 * Checkout's view of the cart (STORY-025): the same revalidated summary
 * getCart returns, plus the resolved Cart row and raw line rows so the
 * checkout service can read guestToken, product weights, and SKUs without
 * re-implementing the revalidation logic here.
 */
export async function getCartForCheckout(userId: string | null, guestCookieValue: string | null | undefined) {
  const { cart, newCookieValue } = await resolveCartIdentity(userId, guestCookieValue ?? undefined);
  const items = await cartRepository.listCartItemsWithProduct(cart.id);
  const summary = await buildSummary(cart, items, userId);
  return { cart, items, summary, newCookieValue };
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

/**
 * Merges a guest cart (identified by the still-present guest cookie) into
 * the now-authenticated user's cart. Matching products combine quantity
 * (capped at current stock — never silently over-adds past what's
 * available); distinct products are appended.
 *
 * The guest Cart row is claimed via a guarded delete (matching both id
 * and guestToken) BEFORE any merge writes happen, not after — this makes
 * two concurrent calls for the same guest cookie (e.g. two tabs both
 * transitioning to authenticated at once) safe: only one call's delete
 * matches a row, and the other sees `claimed === false` and no-ops. The
 * tradeoff versus deleting last is that a crash mid-merge (after the
 * claim, before all writes land) can no longer be retried — the guest
 * cart is already gone — but that is preferable to the alternative of
 * two concurrent callers both applying the same guest items and silently
 * doubling quantities, which deleting last does not prevent.
 *
 * STORY-029: a coupon applied to the guest cart is deliberately NOT
 * carried over — only `guestItems` are read/copied below, never
 * `guestCart.couponId`. A coupon's eligibility (min-order-value, scope)
 * depends on the *combined* post-merge cart, which wasn't known at apply
 * time; the customer sees a clear notice and can re-apply. See
 * docs/architecture-decisions.md.
 */
export async function mergeGuestCartIntoUser(userId: string, guestCookieValue: string | undefined): Promise<void> {
  const guestToken = verifyCartCookieValue(guestCookieValue);
  if (!guestToken) return;

  const guestCart = await cartRepository.findCartByGuestToken(guestToken);
  if (!guestCart) return;

  // Fetched before the claim below — deleting the Cart row cascades and
  // removes its CartItems too, so this is the only chance to read them.
  const guestItems = await cartRepository.listCartItemsWithProduct(guestCart.id);

  const claimed = await cartRepository.deleteGuestCartIfMatchesToken(guestCart.id, guestToken);
  if (!claimed) return;

  if (guestItems.length === 0) return;

  const { cart: userCart } = await resolveCartIdentity(userId, undefined);
  const userItems = await cartRepository.listCartItemsWithProduct(userCart.id);
  const userItemByProductId = new Map(userItems.map((item) => [item.productId, item]));

  for (const guestItem of guestItems) {
    const existing = userItemByProductId.get(guestItem.productId);
    const combinedQuantity = (existing?.quantity ?? 0) + guestItem.quantity;
    const product = await findProductById(guestItem.productId);
    if (!product || product.status !== "Published" || !product.inStock) continue; // dropped, same convention addItem's requireAvailableProduct enforces
    const cappedQuantity = Math.min(combinedQuantity, product.stockQuantity);
    if (cappedQuantity <= 0) continue;

    const resolved = await resolvePrice({ productId: guestItem.productId, customerGroup: "Retail", quantity: cappedQuantity });
    const unitPrice = resolved?.price.toFixed(2) ?? guestItem.unitPriceSnapshot.toFixed(2);

    if (existing) {
      await cartRepository.updateCartItemQuantity(existing.id, cappedQuantity);
      await cartRepository.updateCartItemSnapshot(existing.id, unitPrice);
    } else {
      await cartRepository.upsertCartItem(userCart.id, guestItem.productId, cappedQuantity, unitPrice);
    }
  }
}
