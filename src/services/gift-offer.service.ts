import { randomUUID } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import * as cartRepository from "@/repositories/cart.repository";
import type { CartItemWithProduct } from "@/repositories/cart.repository";
import * as giftOfferRepository from "@/repositories/gift-offer.repository";
import type { GiftOfferWithProducts } from "@/repositories/gift-offer.repository";
import {
  CartItemForbiddenError,
  CartItemNotFoundError,
  GiftOfferIneligibleError,
  GiftOfferRedemptionLimitExceededError,
  GiftOfferStockExceededError,
  GiftOfferUnavailableError,
} from "@/services/cart.errors";
import { recordAddToCartInteraction, requireAvailableProduct, resolveCartIdentity, type CartIdentityResult } from "@/services/cart-identity.service";
import { isActiveAndInWindow } from "@/services/eligibility-window";
import { resolveCustomerGroupForUser, resolvePrice } from "@/services/pricing.service";
import { requireAvailableVariant } from "@/services/product-variant.service";

/**
 * Customer-facing cart orchestration for free gifts (Story 5, Option C).
 * Mirrors bundle.service.ts's own split: a gift's cart line is NEVER
 * priced from the gift product's live catalog price — unitPriceSnapshot
 * is unconditionally "0.00", set here once and re-asserted on every cart
 * read (see resolveGiftLinePrices, called from cart.service.ts::buildSummary).
 * A gift instance in the cart always represents exactly one "add gift to
 * cart" action, tagged with a giftInstanceId (mirrors bundleInstanceId).
 */

/**
 * giftStockLimit is a cap on gift UNITS, not redemptions — each redemption
 * grants giftQuantity units, so exhaustion is
 * `redemptionCount * giftQuantity >= giftStockLimit`, not a bare
 * redemption count (which would under-count whenever giftQuantity > 1).
 * Only checks the physical stock pool here — redemptionLimitGlobal/
 * redemptionLimitPerCustomer depend on customer identity (userId/
 * guestEmail), which, same as coupon.service.ts::validateCoupon's own
 * guestEmail convention, isn't known for a guest until checkout — see
 * assertGiftOfferRedeemable below, enforced there instead.
 */
async function assertGiftOfferPurchasable(offer: GiftOfferWithProducts): Promise<void> {
  if (!isActiveAndInWindow(offer)) throw new GiftOfferUnavailableError();
  if (offer.giftStockLimit !== null) {
    const redeemed = await giftOfferRepository.countRedemptions(offer.id);
    if (redeemed * offer.giftQuantity >= offer.giftStockLimit) throw new GiftOfferStockExceededError();
  }
}

/** Sums the qualifying product's own cart lines (by productId, any variant) — the basis for minQuantity/minSpend checks. */
function qualifyingLineStats(items: CartItemWithProduct[], qualifyingProductId: string): { quantity: number; spend: number } {
  const lines = items.filter((item) => item.productId === qualifyingProductId && !item.giftOfferId);
  const quantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  const spend = lines.reduce((sum, line) => sum + line.unitPriceSnapshot.toNumber() * line.quantity, 0);
  return { quantity, spend };
}

function assertEligibilityConditionsMet(offer: GiftOfferWithProducts, stats: { quantity: number; spend: number }): void {
  if (offer.minQuantity !== null && stats.quantity < offer.minQuantity) {
    throw new GiftOfferIneligibleError(`Buy at least ${offer.minQuantity} of ${offer.product.name} to unlock this free gift.`);
  }
  if (offer.minSpend !== null && stats.spend < offer.minSpend.toNumber()) {
    throw new GiftOfferIneligibleError(`Spend at least LKR ${offer.minSpend.toNumber().toLocaleString()} on ${offer.product.name} to unlock this free gift.`);
  }
}

export async function addGiftToCart(userId: string | null, guestCookieValue: string | null | undefined, giftOfferId: string): Promise<CartIdentityResult> {
  const identity = await resolveCartIdentity(userId, guestCookieValue ?? undefined);
  const offer = await giftOfferRepository.findGiftOfferById(giftOfferId);
  if (!offer) throw new GiftOfferUnavailableError();
  await assertGiftOfferPurchasable(offer);

  // Confirm the gift product/variant itself is available before checking
  // eligibility conditions — an exhausted gift shouldn't surface as
  // "you haven't met the conditions" when the real reason is stock.
  if (offer.giftVariantId) {
    await requireAvailableVariant(offer.giftVariantId, offer.giftQuantity);
  } else {
    await requireAvailableProduct(offer.giftProductId, offer.giftQuantity);
  }

  const existingItems = await cartRepository.listCartItemsWithProduct(identity.cart.id);
  assertEligibilityConditionsMet(offer, qualifyingLineStats(existingItems, offer.productId));

  const customerGroup = await resolveCustomerGroupForUser(userId);

  // Selecting the gift option is one of three mutually exclusive ways to
  // buy the main product (per the spec) — ensure the qualifying product's
  // own line is represented in the cart, same as selecting a bundle
  // guarantees its component is represented. Only backfills at quantity 1
  // when genuinely absent; an existing line's quantity is left untouched.
  const alreadyQualifying = qualifyingLineStats(existingItems, offer.productId).quantity > 0;
  if (!alreadyQualifying) {
    await requireAvailableProduct(offer.productId, 1);
    const resolved = await resolvePrice({ productId: offer.productId, customerGroup, quantity: 1 });
    await cartRepository.upsertCartItem(identity.cart.id, offer.productId, null, 1, (resolved?.price ?? new Prisma.Decimal(0)).toFixed(2));
  }

  const giftInstanceId = randomUUID();
  await cartRepository.upsertCartItem(identity.cart.id, offer.giftProductId, offer.giftVariantId, offer.giftQuantity, "0.00", null, null, {
    giftOfferId: offer.id,
    giftInstanceId,
  });

  recordAddToCartInteraction(userId, offer.giftProductId).catch((error) => {
    console.error("[gift-offer] failed to record AddToCart interaction", error);
  });

  return identity;
}

export async function removeGiftFromCart(userId: string | null, guestCookieValue: string | null | undefined, giftInstanceId: string): Promise<void> {
  const { cart } = await resolveCartIdentity(userId, guestCookieValue ?? undefined);
  const items = await cartRepository.listGiftInstanceItems(cart.id, giftInstanceId);
  if (items.length === 0) throw new CartItemNotFoundError();
  if (items.some((item) => item.cartId !== cart.id)) throw new CartItemForbiddenError();
  await cartRepository.deleteGiftInstance(cart.id, giftInstanceId);
}

export interface GiftLineResolution {
  /** giftInstanceId values whose offer is no longer valid (deactivated, out of window, gift stock exhausted, or the qualifying condition no longer met) — those rows flag `unavailable`, never silently re-priced. */
  invalidInstanceIds: Set<string>;
}

/**
 * Called once per cart.service.ts::buildSummary read, batched over every
 * distinct gift offer the cart currently holds — same discipline as
 * bundle.service.ts::resolveBundleInstancePrices. A gift line's price is
 * NEVER re-derived here (it's unconditionally 0) — this only decides
 * validity. Non-throwing by design: an exhausted/deactivated offer marks
 * its instance invalid rather than rejecting the whole cart read.
 */
export async function resolveGiftLinePrices(items: CartItemWithProduct[]): Promise<GiftLineResolution> {
  const invalidInstanceIds = new Set<string>();

  const giftRows = items.filter((item) => item.giftInstanceId && item.giftOfferId);
  if (giftRows.length === 0) return { invalidInstanceIds };

  const giftOfferIds = [...new Set(giftRows.map((item) => item.giftOfferId as string))];
  const offers = await Promise.all(giftOfferIds.map((id) => giftOfferRepository.findGiftOfferById(id)));
  const offerById = new Map(offers.filter((offer): offer is GiftOfferWithProducts => offer !== null).map((offer) => [offer.id, offer]));

  // Batched once per distinct offer (never per row) — same discipline
  // bundle.service.ts::resolveBundleInstancePrices follows for its own
  // bundle-definition fetch.
  const stockLimitedOfferIds = [...offerById.values()].filter((offer) => offer.giftStockLimit !== null).map((offer) => offer.id);
  const redemptionCounts = await Promise.all(stockLimitedOfferIds.map((id) => giftOfferRepository.countRedemptions(id)));
  const redeemedCountByOfferId = new Map(stockLimitedOfferIds.map((id, index) => [id, redemptionCounts[index]]));

  for (const row of giftRows) {
    const instanceId = row.giftInstanceId as string;
    const offer = offerById.get(row.giftOfferId as string);
    if (!offer) {
      invalidInstanceIds.add(instanceId);
      continue;
    }
    if (!isActiveAndInWindow(offer)) {
      invalidInstanceIds.add(instanceId);
      continue;
    }
    // giftStockLimit caps gift UNITS, not redemptions — see
    // assertGiftOfferPurchasable's own comment for why the multiplication
    // by giftQuantity is necessary.
    if (offer.giftStockLimit !== null) {
      const redeemed = redeemedCountByOfferId.get(offer.id) ?? 0;
      if (redeemed * offer.giftQuantity >= offer.giftStockLimit) {
        invalidInstanceIds.add(instanceId);
        continue;
      }
    }
    try {
      if (offer.giftVariantId) await requireAvailableVariant(offer.giftVariantId, row.quantity);
      else await requireAvailableProduct(offer.giftProductId, row.quantity);
    } catch {
      invalidInstanceIds.add(instanceId);
      continue;
    }
    try {
      assertEligibilityConditionsMet(offer, qualifyingLineStats(items, offer.productId));
    } catch {
      invalidInstanceIds.add(instanceId);
    }
  }

  return { invalidInstanceIds };
}

/**
 * Checkout-time re-validation (checkout.service.ts::requireCheckoutableCart
 * already catches a deactivated/expired/stock-exhausted offer or an
 * unmet qualifying condition via resolveGiftLinePrices folding into the
 * cart's own `unavailable` flag — this function covers the one thing that
 * check cannot: redemptionLimitGlobal/redemptionLimitPerCustomer, which
 * depend on customer identity. Same convention as
 * coupon.service.ts::validateCoupon's own guestEmail parameter — null for
 * every call except from inside placeOrder, once the guest's email is
 * actually known. Throws (never silently drops the line) since by
 * checkout the customer has already confirmed intent to buy — this
 * mirrors validateCoupon's own throwing re-check, distinct from the
 * cart's softer read-only flag.
 */
export async function assertGiftOfferRedeemableAtCheckout(giftOfferId: string, userId: string | null, guestEmail: string | null): Promise<void> {
  const offer = await giftOfferRepository.findGiftOfferById(giftOfferId);
  if (!offer) throw new GiftOfferUnavailableError();
  if (!isActiveAndInWindow(offer)) throw new GiftOfferUnavailableError();

  if (offer.giftStockLimit !== null) {
    const redeemed = await giftOfferRepository.countRedemptions(offer.id);
    if (redeemed * offer.giftQuantity >= offer.giftStockLimit) throw new GiftOfferStockExceededError();
  }
  if (offer.redemptionLimitGlobal !== null) {
    const redeemed = await giftOfferRepository.countRedemptions(offer.id);
    if (redeemed >= offer.redemptionLimitGlobal) throw new GiftOfferRedemptionLimitExceededError();
  }
  if (offer.redemptionLimitPerCustomer !== null && (userId || guestEmail)) {
    const customerCount = await giftOfferRepository.countCustomerRedemptions(offer.id, userId, guestEmail);
    if (customerCount >= offer.redemptionLimitPerCustomer) throw new GiftOfferRedemptionLimitExceededError();
  }
}
