import { verifyCartCookieValue } from "@/lib/cart-token";
import * as addressRepository from "@/repositories/address.repository";
import { findOrderByIdempotencyKey } from "@/repositories/order.repository";
import { getCartForCheckout } from "@/services/cart.service";
import {
  CartInvalidError,
  DeliveryUnavailableError,
  EmptyCartError,
  GuestEmailRequiredError,
  PaymentNotConfirmedError,
  TotalsChangedError,
} from "@/services/checkout.errors";
import { createOrder, getOrderForConfirmation } from "@/services/order.service";
import type { PlacedOrder } from "@/services/order.service";
import { createPaymentIntent, getPaymentByReference } from "@/services/payment.service";
import { resolveDelivery } from "@/services/shipping.service";
import type { DeliveryResolution, OrderConfirmationSummary, PaymentIntentResult, SavedAddress } from "@/types/checkout";
import type { CheckoutAddressInput, PlaceOrderInput } from "@/validation/checkout.schema";

/**
 * Checkout orchestration (STORY-025). This service owns NO pricing, zone,
 * or payment-provider logic — it sequences cart.service (STORY-024),
 * shipping.service (STORY-027 slice), payment.service (STORY-026 slice),
 * and order.service (STORY-028 slice). Every amount is recomputed
 * server-side here; client-supplied totals are never read.
 */

const roundMoney = (value: number) => Math.round(value * 100) / 100;

interface CheckoutCartState {
  cartId: string;
  guestToken: string | null;
  subtotal: number;
  currency: string;
  rewardPointsEarned: number;
  /** null when any line's product has no weight — weight-based zones fail safe. */
  totalWeightGrams: number | null;
  lines: Array<{
    productId: string;
    productName: string;
    productSku: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    rewardPointsEarned: number;
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
  let totalWeightGrams: number | null = 0;
  for (const item of items) {
    const weight = item.product.weightGrams;
    if (weight === null) {
      totalWeightGrams = null;
      break;
    }
    totalWeightGrams += weight * item.quantity;
  }

  return {
    cartId: cart.id,
    guestToken: cart.guestToken,
    subtotal: summary.subtotal,
    currency: summary.currency,
    rewardPointsEarned: summary.rewardPointsEarned,
    totalWeightGrams,
    lines: summary.items.map((line) => ({
      productId: line.productId,
      productName: line.productName,
      productSku: productById.get(line.productId)?.sku ?? "",
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      lineTotal: line.lineTotal,
      rewardPointsEarned: line.rewardPointsEarned,
    })),
  };
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
 * (live cart subtotal + freshly resolved delivery charge for the city).
 */
export async function createIntentForCart(
  userId: string | null,
  guestCookieValue: string | null | undefined,
  city: string,
): Promise<PaymentIntentResult> {
  const cart = await requireCheckoutableCart(userId, guestCookieValue);
  const delivery = await resolveDelivery(city, cart.subtotal, cart.totalWeightGrams);
  if (delivery.status !== "ok") throw new DeliveryUnavailableError(delivery.status);
  const grandTotal = roundMoney(cart.subtotal + delivery.charge);
  return createPaymentIntent(grandTotal, cart.currency);
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
  const delivery = await resolveDelivery(input.address.city, cart.subtotal, cart.totalWeightGrams);
  if (delivery.status !== "ok") throw new DeliveryUnavailableError(delivery.status);
  const grandTotal = roundMoney(cart.subtotal + delivery.charge);

  const payment = await getPaymentByReference(input.providerReference);
  if (!payment || payment.status !== "Succeeded") throw new PaymentNotConfirmedError();
  if (payment.amount.toFixed(2) !== grandTotal.toFixed(2)) throw new TotalsChangedError();

  const { order, replayed: wasReplay } = await createOrder({
    idempotencyKey: input.idempotencyKey,
    userId,
    guestToken,
    guestEmail: userId ? null : (input.guestEmail ?? null),
    subtotal: cart.subtotal.toFixed(2),
    deliveryCharge: delivery.charge.toFixed(2),
    grandTotal: grandTotal.toFixed(2),
    rewardPointsEarned: cart.rewardPointsEarned,
    paymentId: payment.id,
    deliveryZoneName: delivery.zoneName,
    estimatedDaysMin: delivery.estimatedDaysMin,
    estimatedDaysMax: delivery.estimatedDaysMax,
    shipRecipientName: input.address.recipientName,
    shipPhone: input.address.phone,
    shipLine1: input.address.line1,
    shipLine2: input.address.line2 ?? null,
    shipCity: input.address.city,
    shipDistrict: input.address.district ?? null,
    shipPostalCode: input.address.postalCode ?? null,
    items: cart.lines.map((line) => ({
      productId: line.productId,
      productName: line.productName,
      productSku: line.productSku,
      unitPrice: line.unitPrice.toFixed(2),
      quantity: line.quantity,
      lineTotal: line.lineTotal.toFixed(2),
      rewardPointsEarned: line.rewardPointsEarned,
    })),
    cartId: cart.cartId,
  });

  if (userId && input.save) {
    await addressRepository.createAddress(userId, input.address);
  }

  return { orderNumber: order.orderNumber, replayed: wasReplay };
}

export async function listSavedAddresses(userId: string): Promise<SavedAddress[]> {
  const rows = await addressRepository.listAddressesByUserId(userId);
  return rows.map((row) => ({
    id: row.id,
    recipientName: row.recipientName,
    phone: row.phone,
    line1: row.line1,
    line2: row.line2 ?? undefined,
    city: row.city,
    district: row.district ?? undefined,
    postalCode: row.postalCode ?? undefined,
    isDefault: row.isDefault,
  }));
}

export async function saveAddress(userId: string, address: CheckoutAddressInput): Promise<SavedAddress> {
  const row = await addressRepository.createAddress(userId, address);
  return {
    id: row.id,
    recipientName: row.recipientName,
    phone: row.phone,
    line1: row.line1,
    line2: row.line2 ?? undefined,
    city: row.city,
    district: row.district ?? undefined,
    postalCode: row.postalCode ?? undefined,
    isDefault: row.isDefault,
  };
}

function toConfirmationSummary(order: PlacedOrder): OrderConfirmationSummary {
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    placedAt: order.createdAt.toISOString(),
    guestEmail: order.guestEmail,
    subtotal: order.subtotal.toNumber(),
    deliveryCharge: order.deliveryCharge.toNumber(),
    discount: order.discount.toNumber(),
    tax: order.tax.toNumber(),
    grandTotal: order.grandTotal.toNumber(),
    currency: "LKR",
    rewardPointsEarned: order.rewardPointsEarned,
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
      unitPrice: item.unitPrice.toNumber(),
      quantity: item.quantity,
      lineTotal: item.lineTotal.toNumber(),
    })),
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
