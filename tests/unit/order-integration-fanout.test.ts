// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import type { CreateOrderInput } from "@/repositories/order.repository";
import { registerOrderEventConsumer, resetOrderEventConsumerForTesting } from "@/services/order-integration.service";
import type { OrderEventConsumer } from "@/services/order-integration.service";
import { createOrder } from "@/services/order.service";

/**
 * STORY-031's fan-out fix: order-integration.service.ts used to support
 * only one registered consumer at a time (a plain overwrite). These tests
 * cover the new multi-consumer behavior directly — order-service.test.ts
 * already covers the single-consumer path (mock ERP sync, the default
 * logging fallback) and is left untouched.
 */

let sequence = 0;

async function makeProduct(stockQuantity = 10) {
  sequence += 1;
  return createProduct({
    sku: `ORD-FANOUT-SKU-${sequence}`,
    slug: `ord-fanout-product-${sequence}`,
    name: `Order Fanout Product ${sequence}`,
    status: "Published",
    stockQuantity,
  });
}

async function makePayment(amount: string) {
  sequence += 1;
  return prisma.payment.create({
    data: { provider: "mock", providerReference: `mock_ord-fanout-${sequence}`, status: "Succeeded", amount, currency: "LKR" },
  });
}

async function makeCart() {
  sequence += 1;
  return prisma.cart.create({ data: { guestToken: `ord-fanout-token-${sequence}` } });
}

function orderInput(overrides: Partial<Omit<CreateOrderInput, "orderNumber">> & Pick<Omit<CreateOrderInput, "orderNumber">, "idempotencyKey" | "paymentId" | "cartId" | "items">): Omit<CreateOrderInput, "orderNumber"> {
  return {
    userId: null,
    guestToken: "ord-fanout-guest",
    guestEmail: "guest@test.com",
    subtotal: "100.00",
    deliveryCharge: "50.00",
    discount: "0.00",
    couponCode: null,
    discountLabel: null,
    couponRedemption: null,
    pointsRedeemed: 0,
    pointsRedemptionValue: "0.00",
    pointsRedemption: null,
    grandTotal: "150.00",
    rewardPointsEarned: 10,
    deliveryZoneName: "Western",
    estimatedDaysMin: 1,
    estimatedDaysMax: 3,
    shipRecipientName: "Test Guest",
    shipPhone: "+94 77 123 4567",
    shipLine1: "10 Test Lane",
    shipLine2: null,
    shipCity: "Colombo",
    shipDistrict: null,
    shipPostalCode: null,
    ...overrides,
  };
}

function lineFor(product: { id: string; name: string; sku: string }, quantity: number) {
  return {
    productId: product.id,
    productName: product.name,
    productSku: product.sku,
    unitPrice: "50.00",
    quantity,
    lineTotal: (50 * quantity).toFixed(2),
    rewardPointsEarned: quantity,
  };
}

afterEach(async () => {
  resetOrderEventConsumerForTesting();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.payment.deleteMany({ where: { providerReference: { startsWith: "mock_ord-fanout-" } } });
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany({ where: { guestToken: { startsWith: "ord-fanout-token-" } } });
  await prisma.product.deleteMany({ where: { sku: { startsWith: "ORD-FANOUT-SKU-" } } });
});

async function placeOrder() {
  const product = await makeProduct();
  const payment = await makePayment("150.00");
  const cart = await makeCart();
  return createOrder(orderInput({ idempotencyKey: crypto.randomUUID(), paymentId: payment.id, cartId: cart.id, items: [lineFor(product, 2)] }));
}

describe("order-integration fan-out (STORY-031)", () => {
  it("invokes every registered consumer for the same event", async () => {
    const calls: string[] = [];
    const consumerA: OrderEventConsumer = { async onOrderEvent() { calls.push("A"); } };
    const consumerB: OrderEventConsumer = { async onOrderEvent() { calls.push("B"); } };
    registerOrderEventConsumer(consumerA);
    registerOrderEventConsumer(consumerB);

    const { order } = await placeOrder();

    expect(calls).toEqual(["A", "B"]);
    const event = await prisma.orderIntegrationEvent.findFirstOrThrow({ where: { orderId: order.id } });
    expect(event.status).toBe("Processed");
  });

  it("one consumer failing doesn't block another, but the event is marked Failed", async () => {
    const calls: string[] = [];
    const failing: OrderEventConsumer = {
      async onOrderEvent() {
        calls.push("failing");
        throw new Error("boom");
      },
    };
    const succeeding: OrderEventConsumer = { async onOrderEvent() { calls.push("succeeding"); } };
    registerOrderEventConsumer(failing);
    registerOrderEventConsumer(succeeding);

    const { order } = await placeOrder();

    expect(calls).toEqual(["failing", "succeeding"]);
    const event = await prisma.orderIntegrationEvent.findFirstOrThrow({ where: { orderId: order.id } });
    expect(event.status).toBe("Failed");
    expect(event.error).toBe("boom");
  });

  it("falls back to the default logging consumer when nothing is registered", async () => {
    const { order } = await placeOrder();

    const event = await prisma.orderIntegrationEvent.findFirstOrThrow({ where: { orderId: order.id } });
    expect(event.status).toBe("Processed"); // the logging fallback never throws
  });
});
