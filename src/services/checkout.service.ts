import type { FulfilmentMethod, PaymentMethod } from "@/generated/prisma/client";
import { verifyCartCookieValue } from "@/lib/cart-token";
import * as bundleRepository from "@/repositories/bundle.repository";
import * as couponRepository from "@/repositories/coupon.repository";
import { findOrderByIdempotencyKey } from "@/repositories/order.repository";
import * as systemSettingsRepository from "@/repositories/system-settings.repository";
import { AddressLimitExceededError } from "@/services/address.errors";
import { listAddresses, saveAddressFromCheckout } from "@/services/address.service";
import { getCartForCheckout } from "@/services/cart.service";
import {
  CartInvalidError,
  DeliveryUnavailableError,
  EmptyCartError,
  ExportDetailsRequiredError,
  GuestEmailRequiredError,
  PaymentMethodNotAllowedError,
  PaymentNotConfirmedError,
  PickupUnavailableError,
  TotalsChangedError,
} from "@/services/checkout.errors";
import { CouponNotFoundError } from "@/services/coupon.errors";
import { validateCoupon } from "@/services/coupon.service";
import { resolveDiscountForCart } from "@/services/discount.service";
import { checkRedemptionVelocity } from "@/services/fraud-detection.service";
import type { DiscountableLine } from "@/services/discount.service";
import { createOrder, getOrderForConfirmation } from "@/services/order.service";
import { createManualPaymentIntent, createPaymentIntent, getPaymentByReference } from "@/services/payment.service";
import { resolvePointsRedemptionForCart, validateRedemptionAtPlaceOrder } from "@/services/rewards.service";
import { resolveDelivery } from "@/services/shipping.service";
import { getPickupLocation } from "@/services/system-settings.service";
import type { DeliveryResolution, EligiblePaymentMethod, OrderConfirmationSummary, PaymentIntentResult, SavedAddress } from "@/types/checkout";
import type { CheckoutAddressInput, PlaceOrderInput } from "@/validation/checkout.schema";

/**
 * Checkout orchestration (STORY-025). This service owns NO pricing, zone,
 * discount, or payment-provider logic — it sequences cart.service
 * (STORY-024), discount.service (STORY-029), shipping.service (STORY-027
 * slice), payment.service (STORY-026 slice), and order.service (STORY-028
 * slice). Every amount is recomputed server-side here; client-supplied
 * totals are never read.
 */

const roundMoney = (value: number) => Math.round(value * 100) / 100;

interface CheckoutCartState {
  cartId: string;
  guestToken: string | null;
  couponId: string | null;
  pointsToRedeem: number;
  subtotal: number;
  currency: string;
  rewardPointsEarned: number;
  /** null when any line's product has no weight — weight-based zones fail safe. */
  totalWeightGrams: number | null;
  lines: Array<{
    productId: string;
    productName: string;
    productSku: string;
    variantId: string | null;
    variantName: string | null;
    variantSku: string | null;
    categoryIds: string[];
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    rewardPointsEarned: number;
    /** Story 2 (Bundles). Null for a plain line — see bundle.service.ts. */
    bundleId: string | null;
    bundleInstanceId: string | null;
    bundleName: string | null;
    /** Story 3 (Custom Packaging). Null when no packaging option is selected — see packaging.service.ts. */
    packagingOptionId: string | null;
    packagingMethodName: string | null;
    packagingCharge: number;
    packagingDeclaredAvailability: "Local" | "Export" | null;
    packagingRequiresManualReview: boolean;
    /** Export fulfilment flow. Snapshot of ProductPackagingOption.customerInstructions — shown at checkout Review, not just the PDP. */
    packagingInstructions: string | null;
  }>;
}

/**
 * The revalidated cart, rejected unless every line is purchasable —
 * checkout never proceeds past an unavailable or quantity-capped line
 * (the customer fixes it on the cart page, per STORY-024's notices).
 */
export async function requireCheckoutableCart(userId: string | null, guestCookieValue: string | null | undefined): Promise<CheckoutCartState> {
  const { cart, items, summary } = await getCartForCheckout(userId, guestCookieValue);
  if (summary.items.length === 0) throw new EmptyCartError();
  if (summary.items.some((line) => line.unavailable || line.quantityCapped)) throw new CartInvalidError();

  const productById = new Map(items.map((item) => [item.productId, item.product]));
  const itemById = new Map(items.map((item) => [item.id, item]));
  // A variant line's own weight drives the delivery-zone calc, never the
  // parent product's — the parent's weightGrams is inert once variants
  // exist (see Product Variants story's design decision).
  let totalWeightGrams: number | null = 0;
  for (const item of items) {
    const weight = item.variant ? item.variant.shippingWeightGrams ?? item.variant.netWeightGrams : item.product.weightGrams;
    if (weight === null) {
      totalWeightGrams = null;
      break;
    }
    totalWeightGrams += weight * item.quantity;
  }

  return {
    cartId: cart.id,
    guestToken: cart.guestToken,
    couponId: cart.couponId,
    pointsToRedeem: cart.pointsToRedeem ?? 0,
    subtotal: summary.subtotal,
    currency: summary.currency,
    rewardPointsEarned: summary.rewardPointsEarned,
    totalWeightGrams,
    lines: summary.items.map((line) => ({
      productId: line.productId,
      productName: line.productName,
      productSku: productById.get(line.productId)?.sku ?? "",
      variantId: line.variantId,
      variantName: line.variantName,
      variantSku: itemById.get(line.id)?.variant?.sku ?? null,
      categoryIds: productById.get(line.productId)?.categories.map((category) => category.id) ?? [],
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      lineTotal: line.lineTotal,
      rewardPointsEarned: line.rewardPointsEarned,
      bundleId: itemById.get(line.id)?.bundleId ?? null,
      bundleInstanceId: line.bundleInstanceId,
      bundleName: line.bundleName,
      packagingOptionId: line.packagingOptionId,
      packagingMethodName: line.packagingMethodName,
      packagingCharge: line.packagingCharge,
      packagingDeclaredAvailability: line.packagingDeclaredAvailability,
      packagingRequiresManualReview: line.packagingRequiresManualReview,
      packagingInstructions: line.packagingInstructions,
    })),
  };
}

/**
 * Export fulfilment flow. True when any line was self-declared "taking
 * this abroad" at packaging selection — gates both the new ExportDetails
 * checkout step and whether Pickup is even a legal choice.
 */
function requiresExportDetails(lines: CheckoutCartState["lines"]): boolean {
  return lines.some((line) => line.packagingDeclaredAvailability === "Export");
}

/** Story 2 (Bundles). One entry per distinct bundle instance, with its current stockMode — see createOrderWithStockDecrement's OwnStock decrement step. */
async function resolveBundleInstancesForOrder(lines: CheckoutCartState["lines"]): Promise<Array<{ bundleId: string; bundleInstanceId: string; quantity: number; stockMode: "Derived" | "OwnStock" }>> {
  const bundleIds = [...new Set(lines.filter((line) => line.bundleId && line.bundleInstanceId).map((line) => line.bundleId as string))];
  if (bundleIds.length === 0) return [];
  const bundles = await bundleRepository.findBundlesByIds(bundleIds);
  const stockModeByBundleId = new Map(bundles.map((bundle) => [bundle.id, bundle.stockMode]));
  const instanceIds = new Set<string>();
  const result: Array<{ bundleId: string; bundleInstanceId: string; quantity: number; stockMode: "Derived" | "OwnStock" }> = [];
  for (const line of lines) {
    if (!line.bundleId || !line.bundleInstanceId || instanceIds.has(line.bundleInstanceId)) continue;
    instanceIds.add(line.bundleInstanceId);
    result.push({ bundleId: line.bundleId, bundleInstanceId: line.bundleInstanceId, quantity: 1, stockMode: stockModeByBundleId.get(line.bundleId) ?? "Derived" });
  }
  return result;
}

function toDiscountableLines(cart: CheckoutCartState): DiscountableLine[] {
  return cart.lines.map((line) => ({ productId: line.productId, categoryIds: line.categoryIds, lineTotal: line.lineTotal }));
}

/**
 * Story 4 (Payment Restriction), brief Section 6: "orders containing
 * custom travel/export packaging" — any line with a selected packaging
 * option, regardless of whether that option itself requires manual
 * review (a decoupled Story 3 concept; see docs/architecture-decisions.md).
 * "If a cart mixes standard products with custom-packaged products, apply
 * the restricted payment set to the entire order" — `.some(...)` over
 * every line, not just the packaged ones, satisfies that directly.
 */
function requiresRestrictedPayment(lines: CheckoutCartState["lines"]): boolean {
  return lines.some((line) => line.packagingOptionId !== null);
}

/**
 * The admin-configured, checkout-usable payment methods — optionally
 * narrowed to the brief's restricted set (`allowedForRestrictedOrders`,
 * admin-editable in System Settings rather than hardcoding "Card" +
 * "BankTransfer" in code, per this project's Admin Console Principle).
 * Shared by the customer-facing read below and both server-side
 * enforcement points (createIntentForCart, placeOrder) so there is
 * exactly one definition of "allowed."
 */
async function resolveAllowedPaymentMethods(restricted: boolean): Promise<EligiblePaymentMethod[]> {
  const rows = await systemSettingsRepository.listCheckoutEnabledPaymentMethods();
  const eligible = restricted ? rows.filter((row) => row.allowedForRestrictedOrders) : rows;
  // `method` is guaranteed non-null by listCheckoutEnabledPaymentMethods's own `{ not: null }` filter.
  return eligible.map((row) => ({ method: row.method as PaymentMethod, label: row.label }));
}

/** Customer-facing read for the Payment step — the eligible set for the caller's CURRENT cart, server-derived so the client never has to re-implement the restriction rule. */
export async function listEligiblePaymentMethods(userId: string | null, guestCookieValue: string | null | undefined): Promise<EligiblePaymentMethod[]> {
  const cart = await requireCheckoutableCart(userId, guestCookieValue);
  return resolveAllowedPaymentMethods(requiresRestrictedPayment(cart.lines));
}

/** Step 2: resolve the delivery charge for the caller's live cart. */
export async function resolveDeliveryForCart(
  userId: string | null,
  guestCookieValue: string | null | undefined,
  city: string,
): Promise<DeliveryResolution> {
  const cart = await requireCheckoutableCart(userId, guestCookieValue);
  return resolveDelivery(city, cart.subtotal, cart.totalWeightGrams);
}

/**
 * Step 3: create a payment intent for the server-computed grand total
 * (live cart subtotal + freshly resolved delivery charge for the city,
 * less any applied coupon/promotion discount — STORY-029 — and any
 * points redemption — STORY-030, layered as an additional reduction on
 * top, never competing with the coupon/promotion result). Discount is
 * resolved independently of delivery (shipping.service.ts's own
 * free-shipping-threshold logic keeps using the pre-discount subtotal,
 * untouched by either story — see docs/architecture-decisions.md); a
 * FreeShipping-type discount only zeroes the charge actually billed here,
 * after shipping.service.ts has already computed it.
 */
export async function createIntentForCart(
  userId: string | null,
  guestCookieValue: string | null | undefined,
  city: string | null,
  method: PaymentMethod,
  fulfilmentMethod: FulfilmentMethod = "Delivery",
): Promise<PaymentIntentResult> {
  const cart = await requireCheckoutableCart(userId, guestCookieValue);
  // Story 4 (Payment Restriction). Rejected before any Payment row is
  // ever created — the first of two defense-in-depth gates, mirrored
  // again in placeOrder below for a cart that changed between intent
  // creation and order placement.
  const allowed = await resolveAllowedPaymentMethods(requiresRestrictedPayment(cart.lines));
  if (!allowed.some((entry) => entry.method === method)) throw new PaymentMethodNotAllowedError();

  // Export fulfilment flow. Pickup skips delivery-zone resolution entirely
  // — no charge, no zone — but is only a legal choice for an export-declared
  // cart with an admin-configured pickup location.
  let rawDeliveryCharge = 0;
  if (fulfilmentMethod === "Pickup") {
    if (!requiresExportDetails(cart.lines)) throw new PickupUnavailableError();
    if (!(await getPickupLocation())) throw new PickupUnavailableError();
  } else {
    if (!city) throw new DeliveryUnavailableError("config_error");
    const delivery = await resolveDelivery(city, cart.subtotal, cart.totalWeightGrams);
    if (delivery.status !== "ok") throw new DeliveryUnavailableError(delivery.status);
    rawDeliveryCharge = delivery.charge;
  }

  const discount = await resolveDiscountForCart({ couponId: cart.couponId }, toDiscountableLines(cart), cart.subtotal, rawDeliveryCharge, userId);
  const deliveryCharge = discount.freeShippingApplied ? 0 : rawDeliveryCharge;
  const payableBeforePoints = roundMoney(cart.subtotal - discount.totalAmount + deliveryCharge);
  // STORY-030: points layer as an ADDITIONAL reduction on top of the
  // coupon/promotion result — never part of that take-best competition,
  // since spending your own balance isn't a marketing discount. Silent
  // read (never throws) — mirrors resolveDiscountForCart's relationship
  // to placeOrder's throwing re-validation below.
  const points = await resolvePointsRedemptionForCart(userId, cart.pointsToRedeem, payableBeforePoints);
  const grandTotal = roundMoney(payableBeforePoints - points.discountValue);

  // Story 4 (Payment Restriction). Card alone goes through the real
  // PaymentProvider interface (the mock, until a gateway is chosen —
  // brief: "do not introduce a real payment provider"); BankTransfer and
  // CashOnDelivery have no gateway to call at all, so they write a
  // Pending Payment row directly. See payment.service.ts::createManualPaymentIntent.
  if (method === "Card") return createPaymentIntent(grandTotal, cart.currency);
  return createManualPaymentIntent(method === "BankTransfer" ? "bank_transfer" : "cod", grandTotal, cart.currency);
}

export interface PlaceOrderResult {
  orderNumber: string;
  replayed: boolean;
}

/**
 * Step 4: final revalidation + atomic order creation. Recomputes every
 * amount from the database, verifies the confirmed payment equals the
 * recomputed grand total (a mid-checkout price/stock/charge change means
 * the amounts no longer match → totals_changed, back to Review), then
 * hands order.service the snapshot to create atomically & idempotently.
 */
export async function placeOrder(
  userId: string | null,
  guestCookieValue: string | null | undefined,
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  const guestToken = userId ? null : (verifyCartCookieValue(guestCookieValue ?? undefined) ?? null);

  // An idempotent replay must win before any cart checks — the original
  // request already cleared the cart, so re-running the validations
  // would wrongly reject the retry with empty_cart.
  const replayed = await findOrderByIdempotencyKey(input.idempotencyKey);
  if (replayed) {
    const owned = userId !== null ? replayed.userId === userId : replayed.guestToken !== null && replayed.guestToken === guestToken;
    if (owned) return { orderNumber: replayed.orderNumber, replayed: true };
  }

  if (!userId && !input.guestEmail) throw new GuestEmailRequiredError();

  const cart = await requireCheckoutableCart(userId, guestCookieValue);
  const guestEmailForValidation = userId ? null : (input.guestEmail ?? null);

  // Story 4 (Payment Restriction), second defense-in-depth gate — the
  // cart (and therefore whether restriction even applies) may have
  // changed since the Payment step's intent was created. A now-disallowed
  // method maps to a 409, which the existing checkout wizard already
  // treats as "something changed, back to Payment" (same handling
  // totals_changed already gets) — no new client-side plumbing needed.
  const restricted = requiresRestrictedPayment(cart.lines);
  const allowedMethods = await resolveAllowedPaymentMethods(restricted);
  if (!allowedMethods.some((entry) => entry.method === input.paymentMethod)) throw new PaymentMethodNotAllowedError();

  // Final, THROWING coupon re-validation — distinct from
  // resolveDiscountForCart's silent-skip read below. This is the one
  // point a guest's per-customer usage limit can be enforced (their
  // email only exists from here on), and the only point an
  // exhausted/expired coupon is rejected outright rather than silently
  // contributing $0. See docs/architecture-decisions.md.
  const discountableLines = toDiscountableLines(cart);
  let appliedCoupon: Awaited<ReturnType<typeof couponRepository.findCouponById>> = null;
  if (cart.couponId) {
    appliedCoupon = await couponRepository.findCouponById(cart.couponId);
    if (!appliedCoupon) throw new CouponNotFoundError();
    await validateCoupon(appliedCoupon, discountableLines, cart.subtotal, userId, guestEmailForValidation);
  }

  // Export fulfilment flow. A cart with an export-declared packaging line
  // requires the traveler's details regardless of which sub-choice
  // (Pickup or Deliver) they make; Pickup itself is only legal within that
  // same flow, and only once an admin has configured a pickup location.
  const needsExportDetails = requiresExportDetails(cart.lines);
  if (needsExportDetails && !input.traveler) throw new ExportDetailsRequiredError();
  const fulfilmentMethod: FulfilmentMethod = input.fulfilmentMethod ?? "Delivery";
  if (fulfilmentMethod === "Pickup" && !needsExportDetails) throw new PickupUnavailableError();

  let rawDeliveryCharge = 0;
  let deliveryZoneName: string;
  let estimatedDaysMin: number | null = null;
  let estimatedDaysMax: number | null = null;
  let shipRecipientName: string;
  let shipPhone: string;
  let shipLine1: string;
  let shipLine2: string | null = null;
  let shipCity: string;
  let shipDistrict: string | null = null;
  let shipPostalCode: string | null = null;

  if (fulfilmentMethod === "Pickup") {
    const pickupLocation = await getPickupLocation();
    if (!pickupLocation) throw new PickupUnavailableError();
    // Guaranteed present: needsExportDetails is true here (checked above,
    // since Pickup requires it), and placeOrderSchema doesn't itself
    // enforce traveler on Pickup — this is the one server-side check that does.
    const traveler = input.traveler;
    if (!traveler) throw new ExportDetailsRequiredError();
    shipRecipientName = traveler.travelerName;
    shipPhone = traveler.travelerPhone;
    shipLine1 = pickupLocation.address;
    shipCity = pickupLocation.name;
    deliveryZoneName = `Pickup — ${pickupLocation.name}`;
  } else {
    // Guaranteed present by placeOrderSchema's superRefine (address required for Delivery).
    const address = input.address!;
    const delivery = await resolveDelivery(address.city, cart.subtotal, cart.totalWeightGrams);
    if (delivery.status !== "ok") throw new DeliveryUnavailableError(delivery.status);
    rawDeliveryCharge = delivery.charge;
    deliveryZoneName = delivery.zoneName;
    estimatedDaysMin = delivery.estimatedDaysMin;
    estimatedDaysMax = delivery.estimatedDaysMax;
    shipRecipientName = address.recipientName;
    shipPhone = address.phone;
    shipLine1 = address.line1;
    shipLine2 = address.line2 ?? null;
    shipCity = address.city;
    shipDistrict = address.district ?? null;
    shipPostalCode = address.postalCode ?? null;
  }

  const discount = await resolveDiscountForCart({ couponId: cart.couponId }, discountableLines, cart.subtotal, rawDeliveryCharge, userId);
  const deliveryCharge = discount.freeShippingApplied ? 0 : rawDeliveryCharge;
  const payableBeforePoints = roundMoney(cart.subtotal - discount.totalAmount + deliveryCharge);

  // Final, THROWING points re-validation — mirrors the coupon
  // re-validation above (balance/cap enforced server-side even though
  // the client already constrains input).
  const points =
    userId && cart.pointsToRedeem > 0
      ? await validateRedemptionAtPlaceOrder(userId, cart.pointsToRedeem, payableBeforePoints)
      : { pointsToRedeem: 0, discountValue: 0 };
  const grandTotal = roundMoney(payableBeforePoints - points.discountValue);

  const payment = await getPaymentByReference(input.providerReference);
  if (!payment) throw new PaymentNotConfirmedError();
  if (payment.amount.toFixed(2) !== grandTotal.toFixed(2)) throw new TotalsChangedError();
  // Story 4 (Payment Restriction), brief: "Do not mark an order paid
  // solely because a customer selected card or bank transfer." Card alone
  // requires a real Succeeded confirmation (the existing mock-gateway
  // flow, unchanged). BankTransfer/CashOnDelivery intentionally stay
  // Pending through order placement — settlement happens outside checkout
  // (an admin confirming the order for bank transfer, cash at delivery
  // for COD) — only an already-Failed payment blocks placement.
  if (input.paymentMethod === "Card") {
    if (payment.status !== "Succeeded") throw new PaymentNotConfirmedError();
  } else if (payment.status === "Failed") {
    throw new PaymentNotConfirmedError();
  }

  // Only record a redemption when the coupon actually won a non-zero
  // share of the applied discount(s) — a validly-applied coupon that lost
  // to a better promotion under take-best shouldn't consume the
  // customer's usage allowance for a discount they never received.
  const couponContribution = discount.applied.find((entry) => entry.sourceType === "coupon");
  const couponRedemption = appliedCoupon && couponContribution ? { couponId: appliedCoupon.id, discountAmount: couponContribution.amount.toFixed(2) } : null;
  const discountLabel = discount.applied.length > 0 ? discount.applied.map((entry) => entry.label).join(", ") : null;
  const pointsRedemption = points.pointsToRedeem > 0 && userId ? { userId, points: points.pointsToRedeem } : null;

  // Story 3 (Custom Packaging) + Story 4 (Payment Restriction). Either a
  // manual-review packaging line OR an unverified bank-transfer payment
  // sends the WHOLE order to PendingConfirmation instead of Confirmed —
  // see order.repository.ts::createOrderWithStockDecrement. Confirming
  // the order later is the verification step for BOTH cases (packaging
  // review, bank-transfer receipt) — order.repository.ts::applyStatusTransition
  // additionally flips a BankTransfer Payment to Succeeded at that point.
  const requiresManualReview = cart.lines.some((line) => line.packagingRequiresManualReview) || input.paymentMethod === "BankTransfer";

  const { order, replayed: wasReplay } = await createOrder({
    idempotencyKey: input.idempotencyKey,
    userId,
    guestToken,
    guestEmail: userId ? null : (input.guestEmail ?? null),
    subtotal: cart.subtotal.toFixed(2),
    deliveryCharge: deliveryCharge.toFixed(2),
    discount: discount.totalAmount.toFixed(2),
    couponCode: discount.couponCode,
    discountLabel,
    pointsRedeemed: points.pointsToRedeem,
    pointsRedemptionValue: points.discountValue.toFixed(2),
    pointsRedemption,
    grandTotal: grandTotal.toFixed(2),
    rewardPointsEarned: cart.rewardPointsEarned,
    paymentId: payment.id,
    paymentMethod: input.paymentMethod,
    fulfilmentMethod,
    travelerName: input.traveler?.travelerName ?? null,
    travelerCountry: input.traveler?.travelerCountry ?? null,
    travelerPhone: input.traveler?.travelerPhone ?? null,
    deliveryZoneName,
    estimatedDaysMin,
    estimatedDaysMax,
    shipRecipientName,
    shipPhone,
    shipLine1,
    shipLine2,
    shipCity,
    shipDistrict,
    shipPostalCode,
    items: cart.lines.map((line) => ({
      productId: line.productId,
      productName: line.productName,
      productSku: line.productSku,
      variantId: line.variantId,
      variantName: line.variantName,
      variantSku: line.variantSku,
      unitPrice: line.unitPrice.toFixed(2),
      quantity: line.quantity,
      lineTotal: line.lineTotal.toFixed(2),
      rewardPointsEarned: line.rewardPointsEarned,
      bundleId: line.bundleId,
      bundleInstanceId: line.bundleInstanceId,
      bundleName: line.bundleName,
      packagingOptionId: line.packagingOptionId,
      packagingMethodName: line.packagingMethodName,
      packagingCharge: line.packagingCharge.toFixed(2),
      packagingDeclaredAvailability: line.packagingDeclaredAvailability,
      packagingRequiresManualReview: line.packagingRequiresManualReview,
      packagingInstructions: line.packagingInstructions,
    })),
    // Story 2 (Bundles). Grouped from this same checkout-time cart.lines
    // snapshot — one entry per distinct bundle instance in the cart
    // (always quantity 1, see bundle.service.ts's "one instance = one
    // unit" design decision), carrying the bundle's CURRENT stockMode so
    // order.repository.ts's transaction only decrements the bundle-level
    // counter for OwnStock bundles, never Derived ones.
    bundleInstances: await resolveBundleInstancesForOrder(cart.lines),
    cartId: cart.cartId,
    couponRedemption,
    requiresManualReview,
  });

  if (userId && input.save && input.address) {
    // Best-effort, same as this codebase's other checkout-adjacent side
    // effects — a customer who already has 10 saved addresses (STORY-034's
    // cap) can still complete the order; the address just isn't saved.
    // Pickup orders have no address to save (input.address is undefined).
    try {
      await saveAddressFromCheckout(userId, input.address);
    } catch (error) {
      if (!(error instanceof AddressLimitExceededError)) throw error;
    }
  }

  // STORY-049: best-effort fraud check, never a reason to fail an
  // already-placed order — same framing as the address save above.
  if (userId && pointsRedemption && !wasReplay) {
    try {
      await checkRedemptionVelocity(userId);
    } catch (error) {
      console.error("[checkout] redemption-velocity fraud check failed", error);
    }
  }

  return { orderNumber: order.orderNumber, replayed: wasReplay };
}

export async function listSavedAddresses(userId: string): Promise<SavedAddress[]> {
  const rows = await listAddresses(userId);
  return rows.map((row) => ({
    id: row.id,
    recipientName: row.recipientName,
    phone: row.phone,
    line1: row.line1,
    line2: row.line2 ?? undefined,
    city: row.city,
    district: row.district ?? undefined,
    postalCode: row.postalCode ?? undefined,
    isDefault: row.isDefaultShipping,
  }));
}

export async function saveAddress(userId: string, address: CheckoutAddressInput): Promise<SavedAddress> {
  const row = await saveAddressFromCheckout(userId, address);
  return {
    id: row.id,
    recipientName: row.recipientName,
    phone: row.phone,
    line1: row.line1,
    line2: row.line2 ?? undefined,
    city: row.city,
    district: row.district ?? undefined,
    postalCode: row.postalCode ?? undefined,
    isDefault: row.isDefaultShipping,
  };
}

// Derived from getOrderForConfirmation's actual return shape (includes
// statusHistory) rather than order.service.ts's narrower PlacedOrder
// (createOrder's own return, which doesn't select statusHistory) — this
// function is only ever called with a getOrderForConfirmation result.
function toConfirmationSummary(order: Awaited<ReturnType<typeof getOrderForConfirmation>>): OrderConfirmationSummary {
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    placedAt: order.createdAt.toISOString(),
    guestEmail: order.guestEmail,
    subtotal: order.subtotal.toNumber(),
    deliveryCharge: order.deliveryCharge.toNumber(),
    discount: order.discount.toNumber(),
    discountLabel: order.discountLabel,
    couponCode: order.couponCode,
    pointsRedeemed: order.pointsRedeemed,
    pointsRedemptionValue: order.pointsRedemptionValue.toNumber(),
    tax: order.tax.toNumber(),
    grandTotal: order.grandTotal.toNumber(),
    currency: "LKR",
    paymentMethod: order.paymentMethod,
    rewardPointsEarned: order.rewardPointsEarned,
    fulfilmentMethod: order.fulfilmentMethod,
    travelerName: order.travelerName,
    travelerCountry: order.travelerCountry,
    travelerPhone: order.travelerPhone,
    deliveryZoneName: order.deliveryZoneName,
    estimatedDaysMin: order.estimatedDaysMin,
    estimatedDaysMax: order.estimatedDaysMax,
    shippingAddress: {
      recipientName: order.shipRecipientName,
      phone: order.shipPhone,
      line1: order.shipLine1,
      line2: order.shipLine2 ?? undefined,
      city: order.shipCity,
      district: order.shipDistrict ?? undefined,
      postalCode: order.shipPostalCode ?? undefined,
    },
    items: order.items.map((item) => ({
      productName: item.productName,
      productSku: item.productSku,
      variantName: item.variantName,
      bundleInstanceId: item.bundleInstanceId,
      bundleName: item.bundleName,
      packagingMethodName: item.packagingMethodName,
      packagingCharge: item.packagingCharge?.toNumber() ?? null,
      packagingRequiresManualReview: item.packagingRequiresManualReview,
      packagingInstructions: item.packagingInstructions,
      unitPrice: item.unitPrice.toNumber(),
      quantity: item.quantity,
      lineTotal: item.lineTotal.toNumber(),
    })),
    // STORY-028. findOrderByNumber orders statusHistory oldest-first.
    statusHistory: order.statusHistory.map((entry) => ({
      status: entry.status,
      actor: entry.actor,
      createdAt: entry.createdAt.toISOString(),
    })),
    erpSyncStatus: order.erpSyncStatus,
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    cancellationReason: order.cancellationReason,
  };
}

/** Confirmation view, authorized by session user or guest-cart cookie. */
export async function getConfirmation(
  orderNumber: string,
  userId: string | null,
  guestCookieValue: string | null | undefined,
): Promise<OrderConfirmationSummary> {
  const guestToken = userId ? null : (verifyCartCookieValue(guestCookieValue ?? undefined) ?? null);
  const order = await getOrderForConfirmation(orderNumber, userId, guestToken);
  return toConfirmationSummary(order);
}
