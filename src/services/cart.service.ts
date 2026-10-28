import type { Prisma } from "@/generated/prisma/client";
import { verifyCartCookieValue } from "@/lib/cart-token";
import { findProductById } from "@/repositories/product.repository";
import * as cartRepository from "@/repositories/cart.repository";
import type { CartItemWithProduct } from "@/repositories/cart.repository";
import * as productVariantRepository from "@/repositories/product-variant.repository";
import * as rewardsRepository from "@/repositories/rewards.repository";
import { resolveBundleInstancePrices } from "@/services/bundle.service";
import { resolveGiftLinePrices } from "@/services/gift-offer.service";
import {
  CART_COOKIE_NAME,
  recordAddToCartInteraction,
  requireAvailableProduct,
  resolveCartIdentity,
  type CartIdentityResult,
} from "@/services/cart-identity.service";
import {
  BundleLineLockedError,
  CartItemForbiddenError,
  CartItemNotFoundError,
  GiftLineLockedError,
  PackagingMinimumQuantityError,
} from "@/services/cart.errors";
import { resolveDiscountForCart } from "@/services/discount.service";
import type { DiscountableLine } from "@/services/discount.service";
import { resolvePackagingForCartItems, resolvePackagingSelection, type PackagingSelectionInput } from "@/services/packaging.service";
import { resolveCustomerGroupForUser, resolvePrice } from "@/services/pricing.service";
import { requireAvailableVariant, resolveVariantPrice } from "@/services/product-variant.service";
import { resolveActiveMultiplier } from "@/services/reward-campaign.service";
import { calculatePointsRedemption } from "@/services/rewards-calc";
import type { CartLineItem, CartSummary } from "@/types/cart";

export { CART_COOKIE_NAME, recordAddToCartInteraction, requireAvailableProduct, resolveCartIdentity };
export type { CartIdentityResult };

function toLineItem(
  item: CartItemWithProduct,
  resolvedUnitPrice: number,
  currency: string,
  priceChanged: boolean,
  campaignMultiplier: number,
  bundleInvalid: boolean = false,
  packagingChargeTotal: number = 0,
  packagingInvalid: boolean = false,
  packagingRequiresManualReview: boolean = false,
  packagingNetWeightGrams: number | null = null,
  packagingMinimumChargeApplied: boolean = false,
  giftInvalid: boolean = false,
): CartLineItem {
  // A variant's own dedicated photo (ProductVariantImage) wins over the
  // parent product's photo when the selected variant has one — falls back
  // to the product's own primary image for a variant with none set.
  const primaryImage = item.variant?.images[0] ?? item.product.images[0];
  // A variant line's availability/stock comes entirely from its own
  // ProductVariant row, never the parent Product — see Product Variants
  // story's design decision (parent stock/status is inert once variants exist).
  // bundleInvalid (Story 2) catches a case neither branch below can see on
  // its own: every component can be perfectly in-stock while the BUNDLE
  // DEFINITION itself was deactivated, scheduled out of window, or edited
  // to drop this component — see bundle.service.ts::resolveBundleInstancePrices.
  // packagingInvalid (Story 3) is the same idea for a deactivated/
  // out-of-window/past-cutoff/MOQ-no-longer-met packaging selection.
  // giftInvalid (Story 5) is the same idea for a deactivated/out-of-window/
  // stock-exhausted gift offer, or one whose qualifying condition is no
  // longer met — see gift-offer.service.ts::resolveGiftLinePrices.
  const unavailable =
    bundleInvalid ||
    packagingInvalid ||
    giftInvalid ||
    (item.variant ? !item.variant.isActive || !item.variant.inStock : item.product.status !== "Published" || !item.product.inStock);
  const availableQuantity = item.variant ? item.variant.stockQuantity : item.product.stockQuantity;
  const quantityCapped = item.quantity > availableQuantity;
  return {
    id: item.id,
    productId: item.product.id,
    productName: item.product.name,
    productSlug: item.product.slug,
    variantId: item.variantId,
    variantName: item.variant?.name ?? null,
    bundleInstanceId: item.bundleInstanceId,
    bundleName: item.bundle?.name ?? null,
    giftOfferId: item.giftOfferId,
    giftInstanceId: item.giftInstanceId,
    giftOfferName: item.giftOffer?.name ?? null,
    // Story 3 (Custom Packaging). packagingMethodName is read live off the
    // joined relation (mirrors bundleName) — never trusted from a stale
    // snapshot. packagingChargeTotal is this line's already-final
    // packaging TOTAL (quantity/weight already folded in by
    // packaging.service.ts — never a per-unit rate, see its own header
    // comment), a SEPARATE amount from unitPrice*quantity so the UI can
    // show "product + packaging" as a breakdown; lineTotal below is the
    // one place they're actually summed.
    packagingOptionId: item.packagingOptionId,
    packagingMethodName: item.packagingOption?.packagingMethod.name ?? null,
    packagingCharge: packagingChargeTotal,
    packagingDeclaredAvailability: item.packagingDeclaredAvailability,
    packagingRequiresManualReview,
    packagingLeadTimeDays: item.packagingOption?.leadTimeDays ?? null,
    packagingShelfLifeDays: item.packagingOption?.shelfLifeDays ?? null,
    packagingShelfLifeText: item.packagingOption?.shelfLifeText ?? null,
    packagingInstructions: item.packagingOption?.customerInstructions ?? null,
    // Story 3b (weight-based packaging pricing). chargeType/ratePerGram are
    // read live off the joined option (never stale) — only netWeightGrams
    // and minimumChargeApplied need packaging.service.ts's resolution,
    // since they depend on this line's position within its cart-wide group.
    packagingChargeType: item.packagingOption?.chargeType ?? null,
    packagingRatePerGram: item.packagingOption?.ratePerGram?.toNumber() ?? null,
    packagingNetWeightGrams,
    packagingMinimumChargeApplied,
    imageSrc: primaryImage?.url ?? null,
    imageAlt: primaryImage?.altText ?? item.product.name,
    quantity: item.quantity,
    unitPrice: resolvedUnitPrice,
    currency,
    lineTotal: Math.round((resolvedUnitPrice * item.quantity + packagingChargeTotal) * 100) / 100,
    // STORY-049: campaignMultiplier is 1 with no active RewardCampaign — a no-op, same shape as every other resolved-once-per-cart-read factor here (price, discount).
    // The packaging surcharge deliberately never earns points — an explicit
    // choice, since the brief is silent on it and this avoids inventing a
    // reward rule nobody asked for. A free gift line (Story 5) always earns
    // 0 — rewardPoints is computed flat per-product with no price
    // derivation that would naturally zero it for a $0 line, so this must
    // be explicit.
    rewardPointsEarned: item.giftOfferId ? 0 : Math.round(item.product.rewardPoints * item.quantity * campaignMultiplier),
    priceChanged,
    unavailable,
    quantityCapped,
    availableQuantity,
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
  const customerGroup = await resolveCustomerGroupForUser(userId);
  const [campaignMultiplier, setting, bundleResolution, giftResolution] = await Promise.all([
    resolveActiveMultiplier(customerGroup),
    rewardsRepository.getSetting(),
    resolveBundleInstancePrices(items, customerGroup),
    resolveGiftLinePrices(items),
  ]);
  // Story 3 (Custom Packaging). Pure/synchronous — unlike bundle
  // re-validation, a packaging option's eligibility depends only on its
  // own already-joined row, so this needs no DB round-trip (see
  // packaging.service.ts's own header comment).
  const packagingResolution = resolvePackagingForCartItems(items);
  const lineItems: CartLineItem[] = [];
  const discountableLines: DiscountableLine[] = [];
  for (const item of items) {
    let liveUnitPrice: number;
    let currency: string;
    let bundleInvalid = false;
    let giftInvalid = false;
    if (item.giftInstanceId) {
      // Story 5 (Free Gift). Unconditionally 0 — never derived from the
      // gift product's live catalog price. Checked FIRST, ahead of every
      // other branch (a gift row still has its own variant/product
      // relation populated — the real gift product/variant — but must
      // never be priced like an ordinary line for it).
      giftInvalid = giftResolution.invalidInstanceIds.has(item.giftInstanceId);
      liveUnitPrice = 0;
      currency = item.variant?.currency ?? "LKR";
    } else if (item.bundleInstanceId) {
      // Story 2 (Bundles). Baked-in bundle discount, re-derived fresh on
      // every read exactly like a plain line's price — never trusted from
      // the stored snapshot. Checked FIRST, ahead of the
      // variant/product branches below (which stay untouched), since a
      // bundle row still has its own variant/product relation populated
      // but must never be priced by the ordinary tiers.
      if (bundleResolution.invalidInstanceIds.has(item.bundleInstanceId)) {
        bundleInvalid = true;
        liveUnitPrice = item.unitPriceSnapshot.toNumber();
        currency = item.variant?.currency ?? "LKR";
      } else {
        liveUnitPrice = bundleResolution.priceByItemId.get(item.id) ?? item.unitPriceSnapshot.toNumber();
        currency = item.variant?.currency ?? "LKR";
      }
    } else if (item.variant) {
      // A variant line's price is the variant's own promoPrice-or-price —
      // it never consults the campaign/sale/customerGroup/volumeDiscount
      // tiers, which are scoped to Product only (see Product Variants
      // story's design decision).
      const resolved = resolveVariantPrice(item.variant);
      liveUnitPrice = resolved.price;
      currency = resolved.currency;
    } else {
      const resolved = await resolvePrice({ productId: item.productId, customerGroup, quantity: item.quantity });
      liveUnitPrice = resolved?.price.toNumber() ?? item.unitPriceSnapshot.toNumber();
      currency = resolved?.currency ?? "LKR";
    }
    // A gift line's price is always 0 by construction — this guard is
    // belt-and-suspenders (both sides are already 0) so a future refactor
    // can never accidentally wire a real price into the gift branch
    // without priceChanged silently going true and re-snapshotting it.
    const priceChanged = !bundleInvalid && !giftInvalid && liveUnitPrice !== item.unitPriceSnapshot.toNumber();
    if (priceChanged) {
      await cartRepository.updateCartItemSnapshot(item.id, liveUnitPrice.toFixed(2));
    }

    // Story 3 (Custom Packaging). Gated on !item.bundleInstanceId per the
    // "packaging never combines with a bundle's exploded rows" scope
    // decision (resolvePackagingForCartItems already skips bundle rows).
    // A charge change folds into the existing `priceChanged` flag rather
    // than a second boolean — the UI only ever needs "something about this
    // line's price moved, re-check."
    let packagingInvalid = false;
    let packagingCharge = 0;
    let packagingRequiresManualReview = false;
    let packagingChargeChanged = false;
    if (item.packagingOptionId && !item.bundleInstanceId) {
      const snapshotCharge = item.packagingChargeSnapshot?.toNumber() ?? 0;
      if (packagingResolution.invalidItemIds.has(item.id)) {
        packagingInvalid = true;
        packagingCharge = snapshotCharge;
      } else {
        packagingCharge = packagingResolution.chargeByItemId.get(item.id) ?? snapshotCharge;
        packagingRequiresManualReview = packagingResolution.requiresManualReviewByItemId.get(item.id) ?? false;
        packagingChargeChanged = packagingCharge !== snapshotCharge;
        if (packagingChargeChanged) {
          await cartRepository.updateCartItemPackagingChargeSnapshot(item.id, packagingCharge.toFixed(2));
        }
      }
    }

    const line = toLineItem(
      item,
      liveUnitPrice,
      currency,
      priceChanged || packagingChargeChanged,
      campaignMultiplier,
      bundleInvalid,
      packagingCharge,
      packagingInvalid,
      packagingRequiresManualReview,
      packagingResolution.netWeightGramsByItemId.get(item.id) ?? null,
      packagingResolution.minimumChargeAppliedByItemId.get(item.id) ?? false,
      giftInvalid,
    );
    lineItems.push(line);
    // Story 5 (Free Gift). A gift line is never a discount candidate — its
    // lineTotal is already 0, and letting it into the pool would let a
    // product-scoped coupon/promotion match on the gift product's
    // presence in the cart, which isn't a real purchase of it.
    if (!item.giftOfferId) {
      discountableLines.push({ productId: item.productId, categoryIds: item.product.categories.map((category) => category.id), lineTotal: line.lineTotal });
    }
  }

  const subtotal = Math.round(lineItems.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100;
  const discount = await resolveDiscountForCart({ couponId: cart.couponId }, discountableLines, subtotal, 0, userId);

  // STORY-049: an additive order-value-based bonus on top of the per-product sum above — not a replacement mode. Off (0) when orderValuePointsRate is unset, the existing fail-safe convention every RewardSetting field uses.
  const orderValueBonus = setting?.orderValuePointsRate ? Math.floor(subtotal * setting.orderValuePointsRate.toNumber()) : 0;

  let pointsBalance = 0;
  let pointsRedemption: { points: number; value: number } | null = null;
  if (userId) {
    const balances = await rewardsRepository.getBalances(userId);
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
    rewardPointsEarned: lineItems.reduce((sum, item) => sum + item.rewardPointsEarned, 0) + orderValueBonus,
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
  variantId: string | null = null,
  packaging: PackagingSelectionInput | null = null,
): Promise<CartIdentityResult> {
  const identity = await resolveCartIdentity(userId, guestCookieValue ?? undefined);
  const cartItems = await cartRepository.listCartItemsWithProduct(identity.cart.id);
  // Must also match variantId AND packagingOptionId — two different sizes,
  // or two different packaging choices, of the same product are
  // independent cart lines, never merged into one another's quantity.
  const existingItem = cartItems.find((i) => i.productId === productId && i.variantId === variantId && i.packagingOptionId === (packaging?.packagingOptionId ?? null));
  const totalRequested = (existingItem?.quantity ?? 0) + quantity;

  let unitPrice: string;
  let variant: Awaited<ReturnType<typeof requireAvailableVariant>> | null = null;
  if (variantId) {
    variant = await requireAvailableVariant(variantId, totalRequested);
    unitPrice = resolveVariantPrice(variant).price.toFixed(2);
  } else {
    await requireAvailableProduct(productId, totalRequested);
    const customerGroup = await resolveCustomerGroupForUser(userId);
    const resolved = await resolvePrice({ productId, customerGroup, quantity: totalRequested });
    unitPrice = resolved?.price.toFixed(2) ?? "0.00";
  }

  let packagingForUpsert: { packagingOptionId: string; declaredAvailability: "Local" | "Export"; chargeSnapshot: string } | null = null;
  if (packaging) {
    // Story 3b (weight-based pricing). Sum the weight of every OTHER cart
    // line already sharing this same packagingOptionId (excluding the
    // line this add is merging into, if any — its own weight is already
    // represented by `totalRequested` x this variant's netWeightGrams) so
    // the minimum-order-weight check in resolvePackagingSelection is
    // aggregate-aware, not just this one line's own weight.
    const siblingWeightGrams = cartItems
      .filter((i) => i.id !== existingItem?.id && i.packagingOptionId === packaging.packagingOptionId)
      .reduce((sum, i) => sum + (i.variant?.netWeightGrams ?? 0) * i.quantity, 0);
    const resolved = await resolvePackagingSelection(productId, variant ? { id: variant.id, netWeightGrams: variant.netWeightGrams } : null, totalRequested, packaging, siblingWeightGrams);
    packagingForUpsert = { packagingOptionId: packaging.packagingOptionId, declaredAvailability: packaging.declaredAvailability, chargeSnapshot: resolved.chargeSnapshot.toFixed(2) };
  }

  await cartRepository.upsertCartItem(identity.cart.id, productId, variantId, quantity, unitPrice, null, packagingForUpsert);

  // Best-effort — never block the cart mutation on a tracking write. The
  // whole block (not just trackInteraction's own promise) is guarded:
  // getOrCreateSessionId() itself can reject (e.g. cookies() outside a
  // request scope — a real unit-test regression this caught), and an
  // unguarded await would otherwise fail the mutation above it already
  // committed.
  recordAddToCartInteraction(userId, productId).catch((error) => {
    console.error("[cart] failed to record AddToCart interaction", error);
  });

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
  // Story 2 (Bundles). A bundle's exploded rows can only be resized as a
  // whole group (bundle.service.ts::removeBundleFromCart) — resizing one
  // component independently would silently break the bundle's own
  // min/max and re-priced discount.
  if (item.bundleInstanceId) throw new BundleLineLockedError();
  // Story 5 (Free Gift). A gift row's quantity is fixed by its offer's
  // giftQuantity — resizing it directly would let a customer claim more
  // free units than they're entitled to (the cart drawer renders it with
  // the same generic +/- control as any other line, so this must be
  // enforced server-side, not just omitted from a bespoke UI).
  if (item.giftInstanceId) throw new GiftLineLockedError();
  // Story 3 (Custom Packaging). Lowering below the pinned option's own
  // minimum is rejected synchronously, the same way StockExceededError/
  // ProductUnavailableError already block a mutation rather than letting
  // it land and silently flip `unavailable` on the next read — gives the
  // customer an immediate, actionable choice instead of a confusing
  // surprise later. buildSummary's read-time `unavailable` fallback still
  // exists as a defense-in-depth backstop (e.g. an admin raises the MOQ
  // after the line was added).
  if (item.packagingOption?.minQuantity != null && quantity < item.packagingOption.minQuantity) {
    throw new PackagingMinimumQuantityError(item.packagingOption.minQuantity);
  }

  if (item.variantId) {
    const variant = await requireAvailableVariant(item.variantId, quantity);
    await cartRepository.updateCartItemQuantity(itemId, quantity);
    await cartRepository.updateCartItemSnapshot(itemId, resolveVariantPrice(variant).price.toFixed(2));
    return;
  }
  await requireAvailableProduct(item.productId, quantity);
  const customerGroup = await resolveCustomerGroupForUser(userId);
  const resolved = await resolvePrice({ productId: item.productId, customerGroup, quantity });
  await cartRepository.updateCartItemQuantity(itemId, quantity);
  if (resolved) await cartRepository.updateCartItemSnapshot(itemId, resolved.price.toFixed(2));
}

export async function removeItem(userId: string | null, guestCookieValue: string | null | undefined, itemId: string): Promise<void> {
  const item = await requireOwnCartItem(userId, guestCookieValue, itemId);
  // Story 2 (Bundles). Removing one component of a bundle independently
  // would leave the rest of the bundle's rows orphaned with no definition
  // reference left to re-validate against — use
  // bundle.service.ts::removeBundleFromCart to remove the whole instance.
  if (item.bundleInstanceId) throw new BundleLineLockedError();
  // Story 5 (Free Gift). Use gift-offer.service.ts::removeGiftFromCart
  // instead, so the removal is keyed by giftInstanceId the same way a
  // bundle instance's removal is above.
  if (item.giftInstanceId) throw new GiftLineLockedError();
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
  // Keyed by productId+variantId+bundleInstanceId+packagingOptionId+
  // giftInstanceId — two different sizes, two different packaging choices,
  // or two different bundle/gift instances of the same product must merge
  // independently, never combine into one row's quantity. Including
  // bundleInstanceId here is the fix for a real bug: an earlier version of
  // this key omitted it, which let a guest bundle's exploded component
  // rows silently fold into an unrelated existing line's quantity (or, on
  // no match, get re-inserted with bundleId/bundleInstanceId hard-coded
  // null below) — dissolving the bundle grouping entirely, after which
  // "Remove bundle" 404s because bundle.service.ts::removeBundleFromCart
  // can no longer find any row carrying that instance id. A
  // bundleInstanceId is unique per add-to-cart action, so a guest bundle
  // component never actually matches an existing user-cart row via this
  // key — it always takes the "insert new" branch below, which now also
  // carries its bundle tag through correctly. giftInstanceId (Story 5)
  // needs the identical treatment, for the identical reason.
  const lineKey = (productId: string, variantId: string | null, bundleInstanceId: string | null, packagingOptionId: string | null, giftInstanceId: string | null) =>
    `${productId}:${variantId ?? ""}:${bundleInstanceId ?? ""}:${packagingOptionId ?? ""}:${giftInstanceId ?? ""}`;
  const userItemByKey = new Map(
    userItems.map((item) => [lineKey(item.productId, item.variantId, item.bundleInstanceId, item.packagingOptionId, item.giftInstanceId), item]),
  );
  const customerGroup = await resolveCustomerGroupForUser(userId);

  for (const guestItem of guestItems) {
    const existing = userItemByKey.get(
      lineKey(guestItem.productId, guestItem.variantId, guestItem.bundleInstanceId, guestItem.packagingOptionId, guestItem.giftInstanceId),
    );
    const combinedQuantity = (existing?.quantity ?? 0) + guestItem.quantity;

    let cappedQuantity: number;
    let unitPrice: string;
    if (guestItem.giftOfferId && guestItem.giftInstanceId) {
      // Story 5 (Free Gift). Never re-priced from the live catalog —
      // unconditionally "0.00" regardless of which branch below runs.
      // Stock is still checked against the real gift product/variant so a
      // gift that's gone out of stock while the guest cart was dormant is
      // correctly dropped, same convention every other branch here uses.
      if (guestItem.variantId) {
        const variant = await productVariantRepository.findVariantById(guestItem.variantId);
        if (!variant || !variant.isActive || !variant.inStock) continue;
        cappedQuantity = Math.min(combinedQuantity, variant.stockQuantity);
      } else {
        const product = await findProductById(guestItem.productId);
        if (!product || product.status !== "Published" || !product.inStock) continue;
        cappedQuantity = Math.min(combinedQuantity, product.stockQuantity);
      }
      if (cappedQuantity <= 0) continue;
      unitPrice = "0.00";
    } else if (guestItem.variantId) {
      const variant = await productVariantRepository.findVariantById(guestItem.variantId);
      if (!variant || !variant.isActive || !variant.inStock) continue; // dropped, same convention requireAvailableVariant enforces
      cappedQuantity = Math.min(combinedQuantity, variant.stockQuantity);
      if (cappedQuantity <= 0) continue;
      unitPrice = resolveVariantPrice(variant).price.toFixed(2);
    } else {
      const product = await findProductById(guestItem.productId);
      if (!product || product.status !== "Published" || !product.inStock) continue; // dropped, same convention addItem's requireAvailableProduct enforces
      cappedQuantity = Math.min(combinedQuantity, product.stockQuantity);
      if (cappedQuantity <= 0) continue;
      const resolved = await resolvePrice({ productId: guestItem.productId, customerGroup, quantity: cappedQuantity });
      unitPrice = resolved?.price.toFixed(2) ?? guestItem.unitPriceSnapshot.toFixed(2);
    }

    if (existing) {
      await cartRepository.updateCartItemQuantity(existing.id, cappedQuantity);
      await cartRepository.updateCartItemSnapshot(existing.id, unitPrice);
    } else {
      // Packaging selection (if any) carries over as-is — the next
      // buildSummary read re-validates/re-prices it live, same as every
      // other cart read, so an eligibility change since the guest cart was
      // created still surfaces correctly rather than needing a re-check here.
      const packaging = guestItem.packagingOptionId
        ? { packagingOptionId: guestItem.packagingOptionId, declaredAvailability: guestItem.packagingDeclaredAvailability ?? "Local", chargeSnapshot: guestItem.packagingChargeSnapshot?.toFixed(2) ?? "0.00" }
        : null;
      // Story 2 (Bundles) bug fix: this used to hard-code `null` here,
      // which silently stripped bundleId/bundleInstanceId off every bundle
      // component row that survived a guest→user cart merge — see the
      // lineKey comment above for the full failure chain this caused.
      const bundle = guestItem.bundleId && guestItem.bundleInstanceId ? { bundleId: guestItem.bundleId, bundleInstanceId: guestItem.bundleInstanceId } : null;
      // Story 5 (Free Gift). Same bug class, same fix — carry the gift tag
      // through instead of silently stripping it.
      const gift = guestItem.giftOfferId && guestItem.giftInstanceId ? { giftOfferId: guestItem.giftOfferId, giftInstanceId: guestItem.giftInstanceId } : null;
      await cartRepository.upsertCartItem(userCart.id, guestItem.productId, guestItem.variantId, cappedQuantity, unitPrice, bundle, packaging, gift);
    }
  }
}
