// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { addItem } from "@/services/cart.service";
import {
  CartInvalidError,
  DeliveryUnavailableError,
  EmptyCartError,
  GuestEmailRequiredError,
  PaymentNotConfirmedError,
  TotalsChangedError,
} from "@/services/checkout.errors";
import {
  createIntentForCart,
  getConfirmation,
  listSavedAddresses,
  placeOrder,
  resolveDeliveryForCart,
} from "@/services/checkout.service";
import { confirmPayment } from "@/services/payment.service";
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

const address: PlaceOrderInput["address"] = {
  recipientName: "Test Guest",
  phone: "+94 77 123 4567",
  line1: "10 Test Lane",
  city: "Colombo",
};

afterEach(async () => {
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.address.deleteMany();
  await prisma.deliveryRateOverride.deleteMany();
  await prisma.deliveryRate.deleteMany();
  await prisma.deliveryZone.deleteMany();
  await prisma.shippingSetting.deleteMany();
  await prisma.standardPrice.deleteMany();
  await prisma.product.deleteMany({ where: { sku: { startsWith: "CHK-SVC-SKU-" } } });
  await prisma.user.deleteMany({ where: { email: { contains: "chk-svc-" } } });
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

    const intent = await createIntentForCart(null, cookie, "Colombo");
    expect(intent.amount).toBe(2350); // 2 × 1000 + 350 flat

    const payment = await prisma.payment.findUnique({ where: { providerReference: intent.providerReference } });
    expect(payment?.amount.toFixed(2)).toBe("2350.00");
  });

  it("refuses to create an intent for an unresolvable delivery city", async () => {
    await makeZone();
    const product = await makeProduct();
    const cookie = await guestCartWith(product.id, 2);

    await expect(createIntentForCart(null, cookie, "Jaffna")).rejects.toBeInstanceOf(DeliveryUnavailableError);
  });
});

describe("placeOrder", () => {
  async function checkoutToConfirmedPayment(cookie: string) {
    const intent = await createIntentForCart(null, cookie, "Colombo");
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
      placeOrder(null, cookie, { idempotencyKey: crypto.randomUUID(), address, providerReference: intent.providerReference }),
    ).rejects.toBeInstanceOf(GuestEmailRequiredError);
  });

  it("rejects an unconfirmed payment", async () => {
    await makeZone();
    const product = await makeProduct();
    const cookie = await guestCartWith(product.id, 2);
    const intent = await createIntentForCart(null, cookie, "Colombo"); // never confirmed

    await expect(
      placeOrder(null, cookie, {
        idempotencyKey: crypto.randomUUID(),
        address,
        guestEmail: "guest@test.com",
        providerReference: intent.providerReference,
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
    const input = { idempotencyKey, address, guestEmail: "guest@test.com", providerReference: intent.providerReference };

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
    const intent = await createIntentForCart(user.id, undefined, "Colombo");
    await confirmPayment(intent.providerReference, { outcome: "success" });

    await placeOrder(user.id, undefined, {
      idempotencyKey: crypto.randomUUID(),
      address,
      providerReference: intent.providerReference,
      save: true,
    });

    const saved = await listSavedAddresses(user.id);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ city: "Colombo", isDefault: true });
  });
});
