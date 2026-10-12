// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createBundle } from "@/repositories/bundle.repository";
import type { CreateOrderInput } from "@/repositories/order.repository";
import { createProduct } from "@/repositories/product.repository";
import { InsufficientStockError } from "@/services/order.errors";
import { cancelOrder, createOrder } from "@/services/order.service";

const SKU_PREFIX = "ORD-BUNDLE-SKU-";
let sequence = 0;

async function makeProduct(stockQuantity: number) {
  sequence += 1;
  return createProduct({
    sku: `${SKU_PREFIX}${sequence}`,
    slug: `ord-bundle-product-${sequence}`,
    name: `Order Bundle Product ${sequence}`,
    status: "Published",
    stockQuantity,
  });
}

async function makeOwnStockBundle(stockQuantity: number) {
  sequence += 1;
  const bundleProduct = await makeProduct(0);
  return createBundle({
    product: { connect: { id: bundleProduct.id } },
    bundleType: "Fixed",
    name: `Order Bundle ${sequence}`,
    stockMode: "OwnStock",
    stockQuantity,
  });
}

async function makePayment(amount: string) {
  sequence += 1;
  return prisma.payment.create({ data: { provider: "mock", providerReference: `mock_ord-bundle-${sequence}`, status: "Succeeded", amount, currency: "LKR" } });
}

async function makeCart() {
  sequence += 1;
  return prisma.cart.create({ data: { guestToken: `ord-bundle-token-${sequence}` } });
}

function orderInput(overrides: Partial<Omit<CreateOrderInput, "orderNumber">> & Pick<Omit<CreateOrderInput, "orderNumber">, "idempotencyKey" | "paymentId" | "cartId" | "items">): Omit<CreateOrderInput, "orderNumber"> {
  return {
    userId: null,
    guestToken: "ord-bundle-guest",
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

function bundleLine(component: { id: string; name: string; sku: string }, bundleId: string, bundleInstanceId: string, bundleName: string, quantity: number) {
  return {
    productId: component.id,
    productName: component.name,
    productSku: component.sku,
    bundleId,
    bundleInstanceId,
    bundleName,
    unitPrice: "50.00",
    quantity,
    lineTotal: (50 * quantity).toFixed(2),
    rewardPointsEarned: 0,
  };
}

afterEach(async () => {
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany({ where: { guestToken: { startsWith: "ord-bundle-" } } });
  await prisma.payment.deleteMany({ where: { providerReference: { startsWith: "mock_ord-bundle-" } } });
  await prisma.bundleItem.deleteMany();
  await prisma.productBundle.deleteMany();
  await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  await prisma.cart.deleteMany({ where: { guestToken: { startsWith: "ord-bundle-token-" } } });
});

describe("OwnStock bundle decrement/restock (Story 2)", () => {
  it("decrements both the bundle's own counter and every component's stock on order placement", async () => {
    const component = await makeProduct(10);
    const bundle = await makeOwnStockBundle(5);
    const payment = await makePayment("100.00");
    const cart = await makeCart();

    const { order } = await createOrder(
      orderInput({
        idempotencyKey: `ord-bundle-idem-${sequence}`,
        paymentId: payment.id,
        cartId: cart.id,
        items: [bundleLine(component, bundle.id, "instance-1", bundle.name, 2)],
        bundleInstances: [{ bundleId: bundle.id, bundleInstanceId: "instance-1", quantity: 1, stockMode: "OwnStock" }],
      }),
    );

    expect(order).toBeTruthy();
    expect((await prisma.productBundle.findUniqueOrThrow({ where: { id: bundle.id } })).stockQuantity).toBe(4);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: component.id } })).stockQuantity).toBe(8);
  });

  it("rolls back the whole order (including component decrements) when the bundle's own stock is insufficient", async () => {
    const component = await makeProduct(10);
    const bundle = await makeOwnStockBundle(0);
    const payment = await makePayment("100.00");
    const cart = await makeCart();

    await expect(
      createOrder(
        orderInput({
          idempotencyKey: `ord-bundle-idem-${sequence}`,
          paymentId: payment.id,
          cartId: cart.id,
          items: [bundleLine(component, bundle.id, "instance-2", bundle.name, 2)],
          bundleInstances: [{ bundleId: bundle.id, bundleInstanceId: "instance-2", quantity: 1, stockMode: "OwnStock" }],
        }),
      ),
    ).rejects.toBeInstanceOf(InsufficientStockError);

    // The component's own decrement must have rolled back too — the whole transaction failed atomically.
    expect((await prisma.product.findUniqueOrThrow({ where: { id: component.id } })).stockQuantity).toBe(10);
  });

  it("does not touch a Derived bundle's stock row (it has none) while still decrementing its components", async () => {
    sequence += 1;
    const component = await makeProduct(10);
    const bundleProduct = await makeProduct(0);
    const bundle = await createBundle({ product: { connect: { id: bundleProduct.id } }, bundleType: "Fixed", name: `Derived Bundle ${sequence}`, stockMode: "Derived" });
    const payment = await makePayment("100.00");
    const cart = await makeCart();

    await createOrder(
      orderInput({
        idempotencyKey: `ord-bundle-idem-${sequence}`,
        paymentId: payment.id,
        cartId: cart.id,
        items: [bundleLine(component, bundle.id, "instance-3", bundle.name, 1)],
        bundleInstances: [{ bundleId: bundle.id, bundleInstanceId: "instance-3", quantity: 1, stockMode: "Derived" }],
      }),
    );

    expect((await prisma.productBundle.findUniqueOrThrow({ where: { id: bundle.id } })).stockQuantity).toBeNull();
    expect((await prisma.product.findUniqueOrThrow({ where: { id: component.id } })).stockQuantity).toBe(9);
  });

  it("restocks the bundle's own counter on cancellation — the direct inverse of the decrement", async () => {
    const component = await makeProduct(10);
    const bundle = await makeOwnStockBundle(5);
    const payment = await makePayment("100.00");
    const cart = await makeCart();

    const { order } = await createOrder(
      orderInput({
        idempotencyKey: `ord-bundle-idem-${sequence}`,
        paymentId: payment.id,
        cartId: cart.id,
        items: [bundleLine(component, bundle.id, "instance-4", bundle.name, 1)],
        bundleInstances: [{ bundleId: bundle.id, bundleInstanceId: "instance-4", quantity: 1, stockMode: "OwnStock" }],
      }),
    );
    expect((await prisma.productBundle.findUniqueOrThrow({ where: { id: bundle.id } })).stockQuantity).toBe(4);

    await cancelOrder(order.orderNumber, null, "ord-bundle-guest", "test cancellation");

    expect((await prisma.productBundle.findUniqueOrThrow({ where: { id: bundle.id } })).stockQuantity).toBe(5);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: component.id } })).stockQuantity).toBe(10);
  });
});
