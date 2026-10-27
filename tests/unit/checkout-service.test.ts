// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { addItem } from "@/services/cart.service";
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
import {
  createIntentForCart,
  getConfirmation,
  listEligiblePaymentMethods,
  listSavedAddresses,
  placeOrder,
  resolveDeliveryForCart,
} from "@/services/checkout.service";
import { confirmPayment } from "@/services/payment.service";
import { addGiftToCart } from "@/services/gift-offer.service";
import type { PlaceOrderInput } from "@/validation/checkout.schema";

let sequence = 0;

async function makeProduct(overrides: Record<string, unknown> = {}) {
  sequence += 1;
  const product = await createProduct({
    sku: `CHK-SVC-SKU-${sequence}`,
    slug: `chk-svc-product-${sequence}`,
    name: `Checkout Svc Product ${sequence}`,
    status: "Published",
    stockQuantity: 10,
    weightGrams: 100,
    ...overrides,
  });
  await prisma.standardPrice.create({ data: { productId: product.id, price: "1000.00" } });
  return product;
}

async function makeZone() {
  return prisma.deliveryZone.create({
    data: {
      name: "Western",
      cities: ["Colombo"],
      rate: { create: { rateType: "Flat", flatAmount: "350.00", estimatedDaysMin: 1, estimatedDaysMax: 2 } },
    },
  });
}

async function guestCartWith(productId: string, quantity: number): Promise<string> {
  const identity = await addItem(null, undefined, productId, quantity);
  return identity.newCookieValue!;
}

async function makeVariant(productId: string, overrides: Record<string, unknown> = {}) {
  sequence += 1;
  return prisma.productVariant.create({
    data: {
      productId,
      sku: `CHK-SVC-VARIANT-SKU-${sequence}`,
      name: "100g",
      netWeightGrams: 100,
      price: "1000.00",
      currency: "LKR",
      stockQuantity: 10,
      isActive: true,
      inStock: true,
      ...overrides,
    },
  });
}

async function guestCartWithVariants(productId: string, lines: { variantId: string; quantity: number }[]): Promise<string> {
  let cookie: string | undefined;
  for (const line of lines) {
    const identity = await addItem(null, cookie, productId, line.quantity, line.variantId);
    cookie = identity.newCookieValue ?? cookie;
  }
  return cookie!;
}

const address: PlaceOrderInput["address"] = {
  recipientName: "Test Guest",
  phone: "+94 77 123 4567",
  line1: "10 Test Lane",
  city: "Colombo",
};

/** Story 3 (Custom Packaging). */
async function makePackagingOption(productId: string, overrides: Record<string, unknown> = {}) {
  sequence += 1;
  const method = await prisma.packagingMethod.create({ data: { name: `Checkout Svc Packaging Method ${sequence}` } });
  return prisma.productPackagingOption.create({ data: { productId, packagingMethodId: method.id, charge: "50.00", ...overrides } });
}

/** Story 5 (Free Gift). */
async function makeGiftOffer(qualifyingProduct: { id: string }, giftProduct: { id: string }, overrides: Record<string, unknown> = {}) {
  sequence += 1;
  return prisma.giftOffer.create({
    data: {
      product: { connect: { id: qualifyingProduct.id } },
      name: `Checkout Svc Gift Offer ${sequence}`,
      giftProduct: { connect: { id: giftProduct.id } },
      ...overrides,
    },
  });
}

/**
 * Story 4 (Payment Restriction). Every createIntentForCart/placeOrder call
 * now requires at least one admin-configured, enabled PaymentMethodSetting
 * row to exist — exactly the real-world prerequisite the brief's Admin
 * Console Principle asks for (nothing hardcoded; an admin who hasn't
 * configured any payment methods yet genuinely can't take orders).
 * Seeded fresh before every test here so the pre-existing (pre-Story-4)
 * tests below keep exercising Card's own flow unchanged.
 */
async function seedPaymentMethods() {
  await prisma.paymentMethodSetting.createMany({
    data: [
      { key: "card", label: "Card", enabled: true, sortOrder: 0, method: "Card", allowedForRestrictedOrders: true },
      { key: "bank_transfer", label: "Bank Transfer", enabled: true, sortOrder: 1, method: "BankTransfer", allowedForRestrictedOrders: true },
      { key: "cash_on_delivery", label: "Cash on Delivery", enabled: true, sortOrder: 2, method: "CashOnDelivery", allowedForRestrictedOrders: false },
    ],
  });
}

beforeEach(async () => {
  await seedPaymentMethods();
});

afterEach(async () => {
  await prisma.orderStatusHistory.deleteMany();
  await prisma.giftOfferRedemption.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.giftOffer.deleteMany();
  await prisma.address.deleteMany();
  await prisma.deliveryRateOverride.deleteMany();
  await prisma.deliveryRate.deleteMany();
  await prisma.deliveryZone.deleteMany();
  await prisma.shippingSetting.deleteMany();
  await prisma.productPackagingOption.deleteMany({ where: { packagingMethod: { name: { startsWith: "Checkout Svc Packaging Method " } } } });
  await prisma.packagingMethod.deleteMany({ where: { name: { startsWith: "Checkout Svc Packaging Method " } } });
  await prisma.standardPrice.deleteMany();
  await prisma.productVariant.deleteMany({ where: { sku: { startsWith: "CHK-SVC-VARIANT-SKU-" } } });
  await prisma.product.deleteMany({ where: { sku: { startsWith: "CHK-SVC-SKU-" } } });
  await prisma.user.deleteMany({ where: { email: { contains: "chk-svc-" } } });
  await prisma.paymentMethodSetting.deleteMany();
  await prisma.companySetting.deleteMany({});
});

describe("resolveDeliveryForCart", () => {
  it("rejects an empty cart before touching zone resolution", async () => {
    await expect(resolveDeliveryForCart(null, undefined, "Colombo")).rejects.toBeInstanceOf(EmptyCartError);
  });

  it("resolves the charge from the live cart subtotal and weight", async () => {
    await makeZone();
    const product = await makeProduct();
    const cookie = await guestCartWith(product.id, 2);

    const resolution = await resolveDeliveryForCart(null, cookie, "  colombo ");
    expect(resolution).toMatchObject({ status: "ok", zoneName: "Western", charge: 350 });
  });

  it("rejects a cart with a quantity-capped line", async () => {
    await makeZone();
    const product = await makeProduct();
    const cookie = await guestCartWith(product.id, 2);
    await prisma.product.update({ where: { id: product.id }, data: { stockQuantity: 1 } });

    await expect(resolveDeliveryForCart(null, cookie, "Colombo")).rejects.toBeInstanceOf(CartInvalidError);
  });
});

describe("createIntentForCart", () => {
  it("creates an intent for the server-computed subtotal + delivery charge", async () => {
    await makeZone();
    const product = await makeProduct();
    const cookie = await guestCartWith(product.id, 2);

    const intent = await createIntentForCart(null, cookie, "Colombo", "Card");
    expect(intent.amount).toBe(2350); // 2 × 1000 + 350 flat

    const payment = await prisma.payment.findUnique({ where: { providerReference: intent.providerReference } });
    expect(payment?.amount.toFixed(2)).toBe("2350.00");
  });

  it("refuses to create an intent for an unresolvable delivery city", async () => {
    await makeZone();
    const product = await makeProduct();
    const cookie = await guestCartWith(product.id, 2);

    await expect(createIntentForCart(null, cookie, "Jaffna", "Card")).rejects.toBeInstanceOf(DeliveryUnavailableError);
  });
});

describe("placeOrder", () => {
  async function checkoutToConfirmedPayment(cookie: string) {
    const intent = await createIntentForCart(null, cookie, "Colombo", "Card");
    await confirmPayment(intent.providerReference, { outcome: "success" });
    return intent;
  }

  it("places a guest order end to end and clears the cart", async () => {
    await makeZone();
    const product = await makeProduct();
    const cookie = await guestCartWith(product.id, 2);
    const intent = await checkoutToConfirmedPayment(cookie);

    const result = await placeOrder(null, cookie, {
      idempotencyKey: crypto.randomUUID(),
      address,
      guestEmail: "guest@test.com",
      providerReference: intent.providerReference,
      paymentMethod: "Card",
    });

    expect(result.replayed).toBe(false);
    expect(result.orderNumber).toMatch(/^ORS-/);

    const order = await prisma.order.findUnique({ where: { orderNumber: result.orderNumber }, include: { items: true } });
    expect(order?.grandTotal.toFixed(2)).toBe("2350.00");
    expect(order?.shipCity).toBe("Colombo");
    expect(order?.items[0].productSku).toBe(product.sku);
    expect(order?.guestEmail).toBe("guest@test.com");

    const liveProduct = await prisma.product.findUnique({ where: { id: product.id } });
    expect(liveProduct?.stockQuantity).toBe(8);

    const cartItems = await prisma.cartItem.findMany();
    expect(cartItems).toHaveLength(0);

    // The guest cookie still authorizes the confirmation view.
    const confirmation = await getConfirmation(result.orderNumber, null, cookie);
    expect(confirmation.grandTotal).toBe(2350);
    expect(confirmation.shippingAddress.city).toBe("Colombo");
  });

  it("requires a guest email for guest orders", async () => {
    await makeZone();
    const product = await makeProduct();
    const cookie = await guestCartWith(product.id, 2);
    const intent = await checkoutToConfirmedPayment(cookie);

    await expect(
      placeOrder(null, cookie, { idempotencyKey: crypto.randomUUID(), address, providerReference: intent.providerReference, paymentMethod: "Card" }),
    ).rejects.toBeInstanceOf(GuestEmailRequiredError);
  });

  it("rejects an unconfirmed payment", async () => {
    await makeZone();
    const product = await makeProduct();
    const cookie = await guestCartWith(product.id, 2);
    const intent = await createIntentForCart(null, cookie, "Colombo", "Card"); // never confirmed

    await expect(
      placeOrder(null, cookie, {
        idempotencyKey: crypto.randomUUID(),
        address,
        guestEmail: "guest@test.com",
        providerReference: intent.providerReference,
        paymentMethod: "Card",
      }),
    ).rejects.toBeInstanceOf(PaymentNotConfirmedError);
  });

  it("rejects with totals_changed when a price moved after payment confirmation", async () => {
    await makeZone();
    const product = await makeProduct();
    const cookie = await guestCartWith(product.id, 2);
    const intent = await checkoutToConfirmedPayment(cookie);

    // A price change mid-checkout: the confirmed amount no longer matches.
    await prisma.standardPrice.updateMany({ where: { productId: product.id }, data: { price: "1200.00" } });

    await expect(
      placeOrder(null, cookie, {
        idempotencyKey: crypto.randomUUID(),
        address,
        guestEmail: "guest@test.com",
        providerReference: intent.providerReference,
        paymentMethod: "Card",
      }),
    ).rejects.toBeInstanceOf(TotalsChangedError);

    expect(await prisma.order.count()).toBe(0); // no ghost order
    const liveProduct = await prisma.product.findUnique({ where: { id: product.id } });
    expect(liveProduct?.stockQuantity).toBe(10); // no decrement
  });

  it("replays idempotently after the cart was cleared by the first request", async () => {
    await makeZone();
    const product = await makeProduct();
    const cookie = await guestCartWith(product.id, 2);
    const intent = await checkoutToConfirmedPayment(cookie);
    const idempotencyKey = crypto.randomUUID();
    const input = { idempotencyKey, address, guestEmail: "guest@test.com", providerReference: intent.providerReference, paymentMethod: "Card" as const };

    const first = await placeOrder(null, cookie, input);
    const retry = await placeOrder(null, cookie, input); // cart is empty now — must not reject

    expect(retry.replayed).toBe(true);
    expect(retry.orderNumber).toBe(first.orderNumber);
    expect(await prisma.order.count()).toBe(1);

    const liveProduct = await prisma.product.findUnique({ where: { id: product.id } });
    expect(liveProduct?.stockQuantity).toBe(8);
  });

  it("saves the address for an authenticated caller who asked", async () => {
    await makeZone();
    sequence += 1;
    const user = await prisma.user.create({ data: { email: `chk-svc-${sequence}@test.com` } });
    const product = await makeProduct();
    await addItem(user.id, undefined, product.id, 1);
    const intent = await createIntentForCart(user.id, undefined, "Colombo", "Card");
    await confirmPayment(intent.providerReference, { outcome: "success" });

    await placeOrder(user.id, undefined, {
      idempotencyKey: crypto.randomUUID(),
      address,
      providerReference: intent.providerReference,
      paymentMethod: "Card",
      save: true,
    });

    const saved = await listSavedAddresses(user.id);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ city: "Colombo", isDefault: true });
  });
});

describe("placeOrder — Gift Offers (Story 5)", () => {
  async function checkoutToConfirmedPayment(cookie: string) {
    const intent = await createIntentForCart(null, cookie, "Colombo", "Card");
    await confirmPayment(intent.providerReference, { outcome: "success" });
    return intent;
  }

  it("places an order with a gift line: decrements the gift product's stock, writes an isGiftLine order item, and records a GiftOfferRedemption row", async () => {
    await makeZone();
    const qualifying = await makeProduct();
    const gift = await makeProduct({ stockQuantity: 10 });
    const offer = await makeGiftOffer(qualifying, gift, { giftQuantity: 2 });

    const cookie = await guestCartWith(qualifying.id, 1);
    const { newCookieValue } = await addGiftToCart(null, cookie, offer.id);
    const finalCookie = newCookieValue ?? cookie;
    const intent = await checkoutToConfirmedPayment(finalCookie);

    const result = await placeOrder(null, finalCookie, {
      idempotencyKey: crypto.randomUUID(),
      address,
      guestEmail: "guest@test.com",
      providerReference: intent.providerReference,
      paymentMethod: "Card",
    });

    const order = await prisma.order.findUnique({ where: { orderNumber: result.orderNumber }, include: { items: true } });
    const giftLine = order?.items.find((item) => item.isGiftLine);
    expect(giftLine).toMatchObject({ isGiftLine: true, giftOfferId: offer.id, quantity: 2, unitPrice: expect.anything() });
    expect(giftLine?.unitPrice.toString()).toBe("0");

    const liveGiftProduct = await prisma.product.findUnique({ where: { id: gift.id } });
    expect(liveGiftProduct?.stockQuantity).toBe(8); // 10 - giftQuantity 2

    const redemption = await prisma.giftOfferRedemption.findUnique({ where: { orderId: order!.id } });
    expect(redemption?.giftOfferId).toBe(offer.id);
  });

  it("rejects at checkout when the gift offer was deactivated after the cart-add but before payment confirmation", async () => {
    await makeZone();
    const qualifying = await makeProduct();
    const gift = await makeProduct();
    const offer = await makeGiftOffer(qualifying, gift);

    const cookie = await guestCartWith(qualifying.id, 1);
    const { newCookieValue } = await addGiftToCart(null, cookie, offer.id);
    const finalCookie = newCookieValue ?? cookie;
    const intent = await checkoutToConfirmedPayment(finalCookie);

    await prisma.giftOffer.update({ where: { id: offer.id }, data: { status: "Inactive" } });

    await expect(
      placeOrder(null, finalCookie, {
        idempotencyKey: crypto.randomUUID(),
        address,
        guestEmail: "guest@test.com",
        providerReference: intent.providerReference,
        paymentMethod: "Card",
      }),
    ).rejects.toThrow();

    expect(await prisma.order.count()).toBe(0); // no ghost order
  });

  it("enforces the gift offer's global redemption limit at checkout, even though add-to-cart allowed it", async () => {
    await makeZone();
    const qualifying = await makeProduct();
    const gift = await makeProduct();
    const offer = await makeGiftOffer(qualifying, gift, { redemptionLimitGlobal: 1 });

    // One prior redemption already consumed the global limit.
    const priorOrder = await prisma.order.create({
      data: {
        orderNumber: "CHK-SVC-PRIOR-GIFT-ORDER",
        idempotencyKey: "idem-chk-svc-prior-gift-order",
        status: "Confirmed",
        subtotal: "0.00",
        deliveryCharge: "0.00",
        grandTotal: "0.00",
        deliveryZoneName: "Western",
        shipRecipientName: "Test Customer",
        shipPhone: "+94 77 123 4567",
        shipLine1: "10 Test Lane",
        shipCity: "Colombo",
      },
    });
    await prisma.giftOfferRedemption.create({ data: { giftOfferId: offer.id, orderId: priorOrder.id } });

    const cookie = await guestCartWith(qualifying.id, 1);
    const { newCookieValue } = await addGiftToCart(null, cookie, offer.id); // add-to-cart doesn't check this limit
    const finalCookie = newCookieValue ?? cookie;
    const intent = await checkoutToConfirmedPayment(finalCookie);

    await expect(
      placeOrder(null, finalCookie, {
        idempotencyKey: crypto.randomUUID(),
        address,
        guestEmail: "guest@test.com",
        providerReference: intent.providerReference,
        paymentMethod: "Card",
      }),
    ).rejects.toThrow();

    expect(await prisma.order.count()).toBe(1); // only the prior seeded order — no new ghost order
  });

  it("enforces the gift offer's per-customer redemption limit at checkout, scoped by guest email", async () => {
    await makeZone();
    const qualifying = await makeProduct();
    const gift = await makeProduct();
    const offer = await makeGiftOffer(qualifying, gift, { redemptionLimitPerCustomer: 1 });

    const priorOrder = await prisma.order.create({
      data: {
        orderNumber: "CHK-SVC-PRIOR-GIFT-ORDER-2",
        idempotencyKey: "idem-chk-svc-prior-gift-order-2",
        status: "Confirmed",
        subtotal: "0.00",
        deliveryCharge: "0.00",
        grandTotal: "0.00",
        deliveryZoneName: "Western",
        shipRecipientName: "Test Customer",
        shipPhone: "+94 77 123 4567",
        shipLine1: "10 Test Lane",
        shipCity: "Colombo",
        guestEmail: "repeat-guest@test.com",
      },
    });
    await prisma.giftOfferRedemption.create({ data: { giftOfferId: offer.id, orderId: priorOrder.id, guestEmail: "repeat-guest@test.com" } });

    const cookie = await guestCartWith(qualifying.id, 1);
    const { newCookieValue } = await addGiftToCart(null, cookie, offer.id);
    const finalCookie = newCookieValue ?? cookie;
    const intent = await checkoutToConfirmedPayment(finalCookie);

    await expect(
      placeOrder(null, finalCookie, {
        idempotencyKey: crypto.randomUUID(),
        address,
        guestEmail: "repeat-guest@test.com", // same guest the prior redemption belongs to
        providerReference: intent.providerReference,
        paymentMethod: "Card",
      }),
    ).rejects.toThrow();

    expect(await prisma.order.count()).toBe(1); // only the prior seeded order
  });
});

describe("placeOrder — variants", () => {
  it("places an order with two sizes of the same product as two distinct order lines", async () => {
    await makeZone();
    const product = await makeProduct();
    const small = await makeVariant(product.id, { name: "100g", price: "300.00", stockQuantity: 10 });
    const large = await makeVariant(product.id, { name: "350g", price: "900.00", stockQuantity: 10 });
    const cookie = await guestCartWithVariants(product.id, [
      { variantId: small.id, quantity: 2 },
      { variantId: large.id, quantity: 1 },
    ]);

    const intent = await createIntentForCart(null, cookie, "Colombo", "Card");
    await confirmPayment(intent.providerReference, { outcome: "success" });

    const result = await placeOrder(null, cookie, {
      idempotencyKey: crypto.randomUUID(),
      address,
      guestEmail: "guest@test.com",
      providerReference: intent.providerReference,
      paymentMethod: "Card",
    });

    const order = await prisma.order.findUnique({ where: { orderNumber: result.orderNumber }, include: { items: true } });
    expect(order?.items).toHaveLength(2);
    const smallLine = order?.items.find((item) => item.variantId === small.id);
    const largeLine = order?.items.find((item) => item.variantId === large.id);
    expect(smallLine).toMatchObject({ variantName: "100g", variantSku: small.sku, quantity: 2, unitPrice: expect.anything() });
    expect(smallLine?.unitPrice.toFixed(2)).toBe("300.00");
    expect(largeLine).toMatchObject({ variantName: "350g", variantSku: large.sku, quantity: 1 });
    expect(largeLine?.unitPrice.toFixed(2)).toBe("900.00");

    const smallAfter = await prisma.productVariant.findUnique({ where: { id: small.id } });
    const largeAfter = await prisma.productVariant.findUnique({ where: { id: large.id } });
    expect(smallAfter?.stockQuantity).toBe(8);
    expect(largeAfter?.stockQuantity).toBe(9);
    // The parent product's own stock is untouched — variant lines never decrement it.
    expect((await prisma.product.findUnique({ where: { id: product.id } }))?.stockQuantity).toBe(10);
  });

  it("rejects checkout when a cart's variant went inactive after it was added", async () => {
    await makeZone();
    const product = await makeProduct();
    const variant = await makeVariant(product.id);
    const cookie = await guestCartWithVariants(product.id, [{ variantId: variant.id, quantity: 1 }]);

    await prisma.productVariant.update({ where: { id: variant.id }, data: { isActive: false } });

    await expect(createIntentForCart(null, cookie, "Colombo", "Card")).rejects.toBeInstanceOf(CartInvalidError);
  });
});

describe("placeOrder — Custom Packaging (Story 3)", () => {
  it("a packaging option invalidated between add and checkout is caught by the existing CartInvalidError gate, with no new gate code", async () => {
    await makeZone();
    const product = await makeProduct();
    const option = await makePackagingOption(product.id);
    const identity = await addItem(null, undefined, product.id, 1, null, { packagingOptionId: option.id, declaredAvailability: "Local" });
    const cookie = identity.newCookieValue!;

    await prisma.productPackagingOption.update({ where: { id: option.id }, data: { status: "Discontinued" } });

    await expect(createIntentForCart(null, cookie, "Colombo", "Card")).rejects.toBeInstanceOf(CartInvalidError);
  });

  it("derives requiresManualReview from the cart and creates the order PendingConfirmation, with the packaging snapshot on the order item", async () => {
    await makeZone();
    const product = await makeProduct();
    const option = await makePackagingOption(product.id, { requiresManualReview: true, availability: "Export" });
    const identity = await addItem(null, undefined, product.id, 1, null, { packagingOptionId: option.id, declaredAvailability: "Export" });
    const cookie = identity.newCookieValue!;
    const intent = await createIntentForCart(null, cookie, "Colombo", "Card");
    await confirmPayment(intent.providerReference, { outcome: "success" });

    const result = await placeOrder(null, cookie, {
      idempotencyKey: crypto.randomUUID(),
      fulfilmentMethod: "Delivery",
      address,
      traveler: { travelerName: "Jane Traveler", travelerCountry: "Australia", travelerPhone: "+94771234567" },
      guestEmail: "guest@test.com",
      providerReference: intent.providerReference,
      paymentMethod: "Card",
    });

    const order = await prisma.order.findUnique({ where: { orderNumber: result.orderNumber }, include: { items: true } });
    expect(order?.status).toBe("PendingConfirmation");
    expect(order?.items[0]).toMatchObject({ packagingRequiresManualReview: true, packagingDeclaredAvailability: "Export" });
  });

  it("a packaging line that does NOT require manual review still creates the order Confirmed", async () => {
    await makeZone();
    const product = await makeProduct();
    const option = await makePackagingOption(product.id, { requiresManualReview: false });
    const identity = await addItem(null, undefined, product.id, 1, null, { packagingOptionId: option.id, declaredAvailability: "Local" });
    const cookie = identity.newCookieValue!;
    const intent = await createIntentForCart(null, cookie, "Colombo", "Card");
    await confirmPayment(intent.providerReference, { outcome: "success" });

    const result = await placeOrder(null, cookie, {
      idempotencyKey: crypto.randomUUID(),
      address,
      guestEmail: "guest@test.com",
      providerReference: intent.providerReference,
      paymentMethod: "Card",
    });

    const order = await prisma.order.findUnique({ where: { orderNumber: result.orderNumber } });
    expect(order?.status).toBe("Confirmed");
  });
});

describe("placeOrder — Weight-based packaging (Story 3b)", () => {
  it("persists the per-gram snapshot (charge type, rate, net weight) on the order item, with the charge counted exactly once in grandTotal", async () => {
    await makeZone();
    const product = await makeProduct();
    const variant = await makeVariant(product.id, { netWeightGrams: 200 });
    const option = await makePackagingOption(product.id, { chargeType: "PerGram", charge: "0", ratePerGram: "0.50" });
    const identity = await addItem(null, undefined, product.id, 2, variant.id, { packagingOptionId: option.id, declaredAvailability: "Local" });
    const cookie = identity.newCookieValue!;
    const intent = await createIntentForCart(null, cookie, "Colombo", "Card");
    await confirmPayment(intent.providerReference, { outcome: "success" });

    const result = await placeOrder(null, cookie, {
      idempotencyKey: crypto.randomUUID(),
      address,
      guestEmail: "guest@test.com",
      providerReference: intent.providerReference,
      paymentMethod: "Card",
    });

    const order = await prisma.order.findUnique({ where: { orderNumber: result.orderNumber }, include: { items: true } });
    const item = order!.items[0]!;
    // 200g x 2 x LKR 0.50/g = LKR 200.
    expect(item.packagingChargeType).toBe("PerGram");
    expect(Number(item.packagingRatePerGram)).toBeCloseTo(0.5, 4);
    expect(item.packagingNetWeightGrams).toBe(400);
    expect(item.packagingMinimumChargeApplied).toBe(false);
    expect(Number(item.packagingCharge)).toBeCloseTo(200, 2);
    // variant unit price (1000) x quantity (2) + delivery (350) + packaging (200) — packaging counted once.
    expect(order!.grandTotal.toNumber()).toBeCloseTo(1000 * 2 + 350 + 200, 2);
  });

  it("a PerGram-packaged order is still restricted to Card/BankTransfer, same as a Fixed-charge one", async () => {
    await makeZone();
    const product = await makeProduct();
    const variant = await makeVariant(product.id, { netWeightGrams: 200 });
    const option = await makePackagingOption(product.id, { chargeType: "PerGram", charge: "0", ratePerGram: "0.50" });
    const identity = await addItem(null, undefined, product.id, 1, variant.id, { packagingOptionId: option.id, declaredAvailability: "Local" });
    const cookie = identity.newCookieValue!;

    await expect(createIntentForCart(null, cookie, "Colombo", "CashOnDelivery")).rejects.toBeInstanceOf(PaymentMethodNotAllowedError);
  });
});

describe("Export Fulfilment Flow", () => {
  const traveler = { travelerName: "Jane Traveler", travelerCountry: "Australia", travelerPhone: "+94771234567" };

  async function makeExportCartCookie(overrides: Record<string, unknown> = {}) {
    const product = await makeProduct();
    const option = await makePackagingOption(product.id, { availability: "Export", ...overrides });
    const identity = await addItem(null, undefined, product.id, 1, null, { packagingOptionId: option.id, declaredAvailability: "Export" });
    return identity.newCookieValue!;
  }

  it("rejects Pickup on createIntentForCart when the cart has no export-declared line", async () => {
    await makeZone();
    const product = await makeProduct();
    const cookie = await guestCartWith(product.id, 1);

    await expect(createIntentForCart(null, cookie, null, "Card", "Pickup")).rejects.toBeInstanceOf(PickupUnavailableError);
  });

  it("rejects Pickup on createIntentForCart when no admin has configured a pickup location yet", async () => {
    const cookie = await makeExportCartCookie();

    await expect(createIntentForCart(null, cookie, null, "Card", "Pickup")).rejects.toBeInstanceOf(PickupUnavailableError);
  });

  it("rejects placeOrder for an export-declared cart with no traveler details", async () => {
    await makeZone();
    const cookie = await makeExportCartCookie();
    const intent = await createIntentForCart(null, cookie, "Colombo", "Card");
    await confirmPayment(intent.providerReference, { outcome: "success" });

    await expect(
      placeOrder(null, cookie, {
        idempotencyKey: crypto.randomUUID(),
        address,
        guestEmail: "guest@test.com",
        providerReference: intent.providerReference,
        paymentMethod: "Card",
      }),
    ).rejects.toBeInstanceOf(ExportDetailsRequiredError);
  });

  it("rejects Pickup on placeOrder when the cart has no export-declared line, even with traveler details supplied", async () => {
    await makeZone();
    const product = await makeProduct();
    const cookie = await guestCartWith(product.id, 1);
    const intent = await createIntentForCart(null, cookie, "Colombo", "Card");
    await confirmPayment(intent.providerReference, { outcome: "success" });

    await expect(
      placeOrder(null, cookie, {
        idempotencyKey: crypto.randomUUID(),
        fulfilmentMethod: "Pickup",
        traveler,
        guestEmail: "guest@test.com",
        providerReference: intent.providerReference,
        paymentMethod: "Card",
      }),
    ).rejects.toBeInstanceOf(PickupUnavailableError);
  });

  it("places a Pickup order with a zero delivery charge and ship fields synthesized from the traveler + admin's pickup location", async () => {
    await prisma.companySetting.upsert({
      where: { id: "global" },
      create: { id: "global", pickupLocationName: "Oristor Factory Outlet", pickupLocationAddress: "123 Factory Rd, Colombo" },
      update: { pickupLocationName: "Oristor Factory Outlet", pickupLocationAddress: "123 Factory Rd, Colombo" },
    });
    const cookie = await makeExportCartCookie();

    const intent = await createIntentForCart(null, cookie, null, "Card", "Pickup");
    await confirmPayment(intent.providerReference, { outcome: "success" });

    const result = await placeOrder(null, cookie, {
      idempotencyKey: crypto.randomUUID(),
      fulfilmentMethod: "Pickup",
      traveler,
      guestEmail: "guest@test.com",
      providerReference: intent.providerReference,
      paymentMethod: "Card",
    });

    const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber: result.orderNumber } });
    expect(order.fulfilmentMethod).toBe("Pickup");
    expect(order.deliveryCharge.toFixed(2)).toBe("0.00");
    expect(order.shipRecipientName).toBe(traveler.travelerName);
    expect(order.shipPhone).toBe(traveler.travelerPhone);
    expect(order.shipLine1).toBe("123 Factory Rd, Colombo");
    expect(order.shipCity).toBe("Oristor Factory Outlet");
    expect(order.travelerName).toBe(traveler.travelerName);
    expect(order.travelerCountry).toBe(traveler.travelerCountry);
    expect(order.travelerPhone).toBe(traveler.travelerPhone);
  });

  it("a Deliver (not Pickup) export order still goes through the normal address/delivery-zone flow, with traveler fields layered on top", async () => {
    await makeZone();
    const cookie = await makeExportCartCookie();
    const intent = await createIntentForCart(null, cookie, "Colombo", "Card", "Delivery");
    await confirmPayment(intent.providerReference, { outcome: "success" });

    const result = await placeOrder(null, cookie, {
      idempotencyKey: crypto.randomUUID(),
      fulfilmentMethod: "Delivery",
      address,
      traveler,
      guestEmail: "guest@test.com",
      providerReference: intent.providerReference,
      paymentMethod: "Card",
    });

    const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber: result.orderNumber } });
    expect(order.fulfilmentMethod).toBe("Delivery");
    expect(order.shipCity).toBe("Colombo");
    expect(order.deliveryCharge.toFixed(2)).toBe("350.00");
    expect(order.travelerName).toBe(traveler.travelerName);
  });
});

describe("Restricted Payment Methods (Story 4)", () => {
  it("a standard (no packaging) cart offers every admin-enabled method, including Cash on Delivery — acceptance scenario 14", async () => {
    await makeZone();
    const product = await makeProduct();
    const cookie = await guestCartWith(product.id, 1);

    const methods = await listEligiblePaymentMethods(null, cookie);

    expect(methods.map((m) => m.method).sort()).toEqual(["BankTransfer", "CashOnDelivery", "Card"].sort());
  });

  it("a custom-packaging cart offers only card and bank transfer — acceptance scenario 9", async () => {
    await makeZone();
    const product = await makeProduct();
    const option = await makePackagingOption(product.id);
    const identity = await addItem(null, undefined, product.id, 1, null, { packagingOptionId: option.id, declaredAvailability: "Local" });
    const cookie = identity.newCookieValue!;

    const methods = await listEligiblePaymentMethods(null, cookie);

    expect(methods.map((m) => m.method).sort()).toEqual(["BankTransfer", "Card"].sort());
  });

  it("a mixed cart (standard item + custom-packaged item) still restricts to card/bank transfer — acceptance scenario 10", async () => {
    await makeZone();
    const standard = await makeProduct();
    const packaged = await makeProduct();
    const option = await makePackagingOption(packaged.id);
    const { newCookieValue } = await addItem(null, undefined, standard.id, 1);
    const cookie = newCookieValue!;
    await addItem(null, cookie, packaged.id, 1, null, { packagingOptionId: option.id, declaredAvailability: "Local" });

    const methods = await listEligiblePaymentMethods(null, cookie);

    expect(methods.map((m) => m.method).sort()).toEqual(["BankTransfer", "Card"].sort());
  });

  it("createIntentForCart rejects a disallowed method for a custom-packaging cart before any Payment row is created", async () => {
    await makeZone();
    const product = await makeProduct();
    const option = await makePackagingOption(product.id);
    const identity = await addItem(null, undefined, product.id, 1, null, { packagingOptionId: option.id, declaredAvailability: "Local" });
    const cookie = identity.newCookieValue!;

    await expect(createIntentForCart(null, cookie, "Colombo", "CashOnDelivery")).rejects.toBeInstanceOf(PaymentMethodNotAllowedError);
    expect(await prisma.payment.count()).toBe(0);
  });

  it("createIntentForCart rejects a method with no matching admin-enabled row at all (defense against a client sending a method the admin never configured)", async () => {
    await makeZone();
    const product = await makeProduct();
    const cookie = await guestCartWith(product.id, 1);
    await prisma.paymentMethodSetting.updateMany({ where: { method: "CashOnDelivery" }, data: { enabled: false } });

    await expect(createIntentForCart(null, cookie, "Colombo", "CashOnDelivery")).rejects.toBeInstanceOf(PaymentMethodNotAllowedError);
  });

  it("placeOrder rejects a disallowed method server-side even if a (now-invalid) intent was already created — acceptance scenario 11", async () => {
    await makeZone();
    const product = await makeProduct();
    const option = await makePackagingOption(product.id);

    // An intent is created for the STANDARD cart (Cash on Delivery allowed then)...
    const { newCookieValue } = await addItem(null, undefined, product.id, 1);
    const cookie = newCookieValue!;
    const intent = await createIntentForCart(null, cookie, "Colombo", "CashOnDelivery");

    // ...then the cart gains a custom-packaging line before placing the order.
    await addItem(null, cookie, product.id, 1, null, { packagingOptionId: option.id, declaredAvailability: "Local" });

    await expect(
      placeOrder(null, cookie, { idempotencyKey: crypto.randomUUID(), address, guestEmail: "guest@test.com", providerReference: intent.providerReference, paymentMethod: "CashOnDelivery" }),
    ).rejects.toBeInstanceOf(PaymentMethodNotAllowedError);
    expect(await prisma.order.count()).toBe(0);
  });

  it("a custom-packaging order paid by Card places normally, Confirmed, with the Payment Succeeded", async () => {
    await makeZone();
    const product = await makeProduct();
    const option = await makePackagingOption(product.id, { requiresManualReview: false });
    const identity = await addItem(null, undefined, product.id, 1, null, { packagingOptionId: option.id, declaredAvailability: "Local" });
    const cookie = identity.newCookieValue!;
    const intent = await createIntentForCart(null, cookie, "Colombo", "Card");
    await confirmPayment(intent.providerReference, { outcome: "success" });

    const result = await placeOrder(null, cookie, { idempotencyKey: crypto.randomUUID(), address, guestEmail: "guest@test.com", providerReference: intent.providerReference, paymentMethod: "Card" });

    const order = await prisma.order.findUnique({ where: { orderNumber: result.orderNumber } });
    expect(order?.status).toBe("Confirmed");
    expect(order?.paymentMethod).toBe("Card");
  });

  it("a custom-packaging order paid by Bank Transfer places as PendingConfirmation, with the Payment left Pending — never marked paid solely for selecting the method", async () => {
    await makeZone();
    const product = await makeProduct();
    const option = await makePackagingOption(product.id, { requiresManualReview: false });
    const identity = await addItem(null, undefined, product.id, 1, null, { packagingOptionId: option.id, declaredAvailability: "Local" });
    const cookie = identity.newCookieValue!;
    const intent = await createIntentForCart(null, cookie, "Colombo", "BankTransfer"); // never confirmed — no gateway to confirm with

    const result = await placeOrder(null, cookie, { idempotencyKey: crypto.randomUUID(), address, guestEmail: "guest@test.com", providerReference: intent.providerReference, paymentMethod: "BankTransfer" });

    const order = await prisma.order.findUnique({ where: { orderNumber: result.orderNumber }, include: { payment: true } });
    expect(order?.status).toBe("PendingConfirmation");
    expect(order?.paymentMethod).toBe("BankTransfer");
    expect(order?.payment?.status).toBe("Pending");
  });

  it("a standard order paid by Cash on Delivery places as Confirmed immediately, with the Payment left Pending", async () => {
    await makeZone();
    const product = await makeProduct();
    const cookie = await guestCartWith(product.id, 1);
    const intent = await createIntentForCart(null, cookie, "Colombo", "CashOnDelivery");

    const result = await placeOrder(null, cookie, { idempotencyKey: crypto.randomUUID(), address, guestEmail: "guest@test.com", providerReference: intent.providerReference, paymentMethod: "CashOnDelivery" });

    const order = await prisma.order.findUnique({ where: { orderNumber: result.orderNumber }, include: { payment: true } });
    expect(order?.status).toBe("Confirmed");
    expect(order?.paymentMethod).toBe("CashOnDelivery");
    expect(order?.payment?.status).toBe("Pending");
  });

  it("a plain Card order (no packaging) is unaffected — acceptance scenario 14, the pre-Story-4 regression case", async () => {
    await makeZone();
    const product = await makeProduct();
    const cookie = await guestCartWith(product.id, 1);
    const intent = await createIntentForCart(null, cookie, "Colombo", "Card");
    await confirmPayment(intent.providerReference, { outcome: "success" });

    const result = await placeOrder(null, cookie, { idempotencyKey: crypto.randomUUID(), address, guestEmail: "guest@test.com", providerReference: intent.providerReference, paymentMethod: "Card" });

    const order = await prisma.order.findUnique({ where: { orderNumber: result.orderNumber } });
    expect(order?.status).toBe("Confirmed");
  });
});
