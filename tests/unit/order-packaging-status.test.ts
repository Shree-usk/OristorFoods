// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import type { CreateOrderInput } from "@/repositories/order.repository";
import { createProduct } from "@/repositories/product.repository";
import { createOrder } from "@/services/order.service";

const SKU_PREFIX = "ORD-PACKAGING-SKU-";
let sequence = 0;

async function makeProduct(stockQuantity = 10) {
  sequence += 1;
  return createProduct({
    sku: `${SKU_PREFIX}${sequence}`,
    slug: `ord-packaging-product-${sequence}`,
    name: `Order Packaging Product ${sequence}`,
    status: "Published",
    stockQuantity,
  });
}

async function makePayment(amount: string) {
  sequence += 1;
  return prisma.payment.create({ data: { provider: "mock", providerReference: `mock_ord-packaging-${sequence}`, status: "Succeeded", amount, currency: "LKR" } });
}

async function makeCart() {
  sequence += 1;
  return prisma.cart.create({ data: { guestToken: `ord-packaging-token-${sequence}` } });
}

function orderInput(overrides: Partial<Omit<CreateOrderInput, "orderNumber">> & Pick<Omit<CreateOrderInput, "orderNumber">, "idempotencyKey" | "paymentId" | "cartId" | "items">): Omit<CreateOrderInput, "orderNumber"> {
  return {
    userId: null,
    guestToken: "ord-packaging-guest",
    guestEmail: "guest@test.com",
    subtotal: "100.00",
    deliveryCharge: "0.00",
    discount: "0.00",
    couponCode: null,
    discountLabel: null,
    couponRedemption: null,
    pointsRedeemed: 0,
    pointsRedemptionValue: "0.00",
    pointsRedemption: null,
    grandTotal: "100.00",
    rewardPointsEarned: 0,
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

function plainLine(product: { id: string; name: string; sku: string }) {
  return {
    productId: product.id,
    productName: product.name,
    productSku: product.sku,
    unitPrice: "100.00",
    quantity: 1,
    lineTotal: "100.00",
    rewardPointsEarned: 0,
  };
}

afterEach(async () => {
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany({ where: { guestToken: { startsWith: "ord-packaging-" } } });
  await prisma.payment.deleteMany({ where: { providerReference: { startsWith: "mock_ord-packaging-" } } });
  await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  await prisma.cart.deleteMany({ where: { guestToken: { startsWith: "ord-packaging-token-" } } });
});

describe("Manual-review packaging → order status (Story 3)", () => {
  it("creates the order as PendingConfirmation, with a matching first status-history row, when requiresManualReview is true", async () => {
    const product = await makeProduct();
    const payment = await makePayment("100.00");
    const cart = await makeCart();

    const { order } = await createOrder(
      orderInput({
        idempotencyKey: `ord-packaging-idem-${sequence}`,
        paymentId: payment.id,
        cartId: cart.id,
        items: [{ ...plainLine(product), packagingMethodName: "Vacuum Pouch", packagingCharge: "0.00", packagingDeclaredAvailability: "Export", packagingRequiresManualReview: true }],
        requiresManualReview: true,
      }),
    );

    expect(order.status).toBe("PendingConfirmation");
    const history = await prisma.orderStatusHistory.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "asc" } });
    expect(history).toHaveLength(1);
    expect(history[0]?.status).toBe("PendingConfirmation");
  });

  it("still creates the order as Confirmed, byte-for-byte, when a packaging line does NOT require manual review", async () => {
    const product = await makeProduct();
    const payment = await makePayment("100.00");
    const cart = await makeCart();

    const { order } = await createOrder(
      orderInput({
        idempotencyKey: `ord-packaging-idem-${sequence}`,
        paymentId: payment.id,
        cartId: cart.id,
        items: [{ ...plainLine(product), packagingMethodName: "Foil Pouch", packagingCharge: "0.00", packagingDeclaredAvailability: "Local", packagingRequiresManualReview: false }],
      }),
    );

    expect(order.status).toBe("Confirmed");
    const history = await prisma.orderStatusHistory.findMany({ where: { orderId: order.id } });
    expect(history[0]?.status).toBe("Confirmed");
  });

  it("creates a plain, no-packaging order as Confirmed — the pre-Story-3 regression case", async () => {
    const product = await makeProduct();
    const payment = await makePayment("100.00");
    const cart = await makeCart();

    const { order } = await createOrder(
      orderInput({
        idempotencyKey: `ord-packaging-idem-${sequence}`,
        paymentId: payment.id,
        cartId: cart.id,
        items: [plainLine(product)],
      }),
    );

    expect(order.status).toBe("Confirmed");
  });

  it("snapshots packagingRequiresManualReview on the order item permanently, independent of the order's own later status", async () => {
    const product = await makeProduct();
    const payment = await makePayment("100.00");
    const cart = await makeCart();

    const { order } = await createOrder(
      orderInput({
        idempotencyKey: `ord-packaging-idem-${sequence}`,
        paymentId: payment.id,
        cartId: cart.id,
        items: [{ ...plainLine(product), packagingMethodName: "Vacuum Pouch", packagingCharge: "0.00", packagingDeclaredAvailability: "Export", packagingRequiresManualReview: true }],
        requiresManualReview: true,
      }),
    );

    await prisma.order.update({ where: { id: order.id }, data: { status: "Confirmed" } });

    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    expect(item.packagingRequiresManualReview).toBe(true);
    expect(item.packagingMethodName).toBe("Vacuum Pouch");
  });
});
