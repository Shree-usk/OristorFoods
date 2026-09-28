// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import type { CreateOrderInput } from "@/repositories/order.repository";
import { InsufficientStockError, OrderForbiddenError, OrderNotFoundError } from "@/services/order.errors";
import { createOrder, generateOrderNumber, getOrderForConfirmation } from "@/services/order.service";

let sequence = 0;

async function makeProduct(stockQuantity: number) {
  sequence += 1;
  return createProduct({
    sku: `ORD-SVC-SKU-${sequence}`,
    slug: `ord-svc-product-${sequence}`,
    name: `Order Svc Product ${sequence}`,
    status: "Published",
    stockQuantity,
  });
}

async function makePayment(amount: string) {
  sequence += 1;
  return prisma.payment.create({
    data: { provider: "mock", providerReference: `mock_ord-svc-${sequence}`, status: "Succeeded", amount, currency: "LKR" },
  });
}

async function makeCart() {
  sequence += 1;
  return prisma.cart.create({ data: { guestToken: `ord-svc-token-${sequence}` } });
}

function orderInput(overrides: Partial<Omit<CreateOrderInput, "orderNumber">> & Pick<Omit<CreateOrderInput, "orderNumber">, "idempotencyKey" | "paymentId" | "cartId" | "items">): Omit<CreateOrderInput, "orderNumber"> {
  return {
    userId: null,
    guestToken: "ord-svc-guest",
    guestEmail: "guest@test.com",
    subtotal: "100.00",
    deliveryCharge: "50.00",
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
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.payment.deleteMany({ where: { providerReference: { startsWith: "mock_ord-svc-" } } });
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany({ where: { guestToken: { startsWith: "ord-svc-token-" } } });
  await prisma.product.deleteMany({ where: { sku: { startsWith: "ORD-SVC-SKU-" } } });
});

describe("generateOrderNumber", () => {
  it("produces the ORS-YYYYMMDD-XXXXXX format with an unambiguous alphabet", () => {
    const number = generateOrderNumber(new Date("2026-09-28T12:00:00Z"));
    expect(number).toMatch(/^ORS-20260928-[0-9A-HJKMNP-TV-Z]{6}$/);
  });

  it("produces distinct values across calls", () => {
    const numbers = new Set(Array.from({ length: 50 }, () => generateOrderNumber()));
    expect(numbers.size).toBe(50);
  });
});

describe("createOrder", () => {
  it("creates the order, decrements stock, snapshots items, and clears the cart atomically", async () => {
    const product = await makeProduct(10);
    const payment = await makePayment("150.00");
    const cart = await makeCart();
    await prisma.cartItem.create({ data: { cartId: cart.id, productId: product.id, quantity: 2, unitPriceSnapshot: "50.00" } });

    const { order, replayed } = await createOrder(
      orderInput({ idempotencyKey: crypto.randomUUID(), paymentId: payment.id, cartId: cart.id, items: [lineFor(product, 2)] }),
    );

    expect(replayed).toBe(false);
    expect(order.orderNumber).toMatch(/^ORS-/);
    expect(order.items).toHaveLength(1);
    expect(order.items[0].productName).toBe(product.name);

    const liveProduct = await prisma.product.findUnique({ where: { id: product.id } });
    expect(liveProduct?.stockQuantity).toBe(8);

    const cartItems = await prisma.cartItem.findMany({ where: { cartId: cart.id } });
    expect(cartItems).toHaveLength(0);

    const history = await prisma.orderStatusHistory.findMany({ where: { orderId: order.id } });
    expect(history).toEqual([expect.objectContaining({ status: "Confirmed", actor: "system:checkout" })]);
  });

  it("rolls the whole transaction back on insufficient stock — no ghost order, no partial decrement, cart intact", async () => {
    const plenty = await makeProduct(10);
    const scarce = await makeProduct(1);
    const payment = await makePayment("150.00");
    const cart = await makeCart();

    await expect(
      createOrder(
        orderInput({
          idempotencyKey: crypto.randomUUID(),
          paymentId: payment.id,
          cartId: cart.id,
          items: [lineFor(plenty, 2), lineFor(scarce, 2)],
        }),
      ),
    ).rejects.toBeInstanceOf(InsufficientStockError);

    expect(await prisma.order.count()).toBe(0);
    const untouched = await prisma.product.findUnique({ where: { id: plenty.id } });
    expect(untouched?.stockQuantity).toBe(10); // the first line's decrement rolled back too
  });

  it("replays idempotently: the same key returns the existing order and never decrements twice", async () => {
    const product = await makeProduct(10);
    const payment = await makePayment("150.00");
    const cart = await makeCart();
    const idempotencyKey = crypto.randomUUID();
    const input = orderInput({ idempotencyKey, paymentId: payment.id, cartId: cart.id, items: [lineFor(product, 2)] });

    const first = await createOrder(input);
    const second = await createOrder(input);

    expect(second.replayed).toBe(true);
    expect(second.order.id).toBe(first.order.id);

    const liveProduct = await prisma.product.findUnique({ where: { id: product.id } });
    expect(liveProduct?.stockQuantity).toBe(8);
    expect(await prisma.order.count()).toBe(1);
  });

  it("survives concurrent same-key requests: exactly one order, one decrement", async () => {
    const product = await makeProduct(10);
    const payment = await makePayment("150.00");
    const cart = await makeCart();
    const idempotencyKey = crypto.randomUUID();
    const input = orderInput({ idempotencyKey, paymentId: payment.id, cartId: cart.id, items: [lineFor(product, 2)] });

    // PGlite serializes connections, so this is sequential at the wire but
    // still exercises the P2002-on-idempotencyKey recovery path.
    const results = await Promise.allSettled([createOrder(input), createOrder(input)]);
    const fulfilled = results.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof createOrder>>> => r.status === "fulfilled");

    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    const orderIds = new Set(fulfilled.map((r) => r.value.order.id));
    expect(orderIds.size).toBe(1);
    expect(await prisma.order.count()).toBe(1);

    const liveProduct = await prisma.product.findUnique({ where: { id: product.id } });
    expect(liveProduct?.stockQuantity).toBe(8);
  });

  it("refuses an idempotent replay for a different owner", async () => {
    const product = await makeProduct(10);
    const payment = await makePayment("150.00");
    const cart = await makeCart();
    const idempotencyKey = crypto.randomUUID();
    await createOrder(orderInput({ idempotencyKey, paymentId: payment.id, cartId: cart.id, items: [lineFor(product, 2)] }));

    await expect(
      createOrder(orderInput({ idempotencyKey, guestToken: "someone-else", paymentId: payment.id, cartId: cart.id, items: [lineFor(product, 2)] })),
    ).rejects.toBeInstanceOf(OrderForbiddenError);
  });
});

describe("getOrderForConfirmation", () => {
  it("authorizes by guest token and rejects strangers", async () => {
    const product = await makeProduct(10);
    const payment = await makePayment("150.00");
    const cart = await makeCart();
    const { order } = await createOrder(
      orderInput({ idempotencyKey: crypto.randomUUID(), paymentId: payment.id, cartId: cart.id, items: [lineFor(product, 2)] }),
    );

    const found = await getOrderForConfirmation(order.orderNumber, null, "ord-svc-guest");
    expect(found.id).toBe(order.id);

    await expect(getOrderForConfirmation(order.orderNumber, null, "wrong-token")).rejects.toBeInstanceOf(OrderForbiddenError);
    await expect(getOrderForConfirmation(order.orderNumber, null, null)).rejects.toBeInstanceOf(OrderForbiddenError);
    await expect(getOrderForConfirmation("ORS-00000000-000000", null, "ord-svc-guest")).rejects.toBeInstanceOf(OrderNotFoundError);
  });
});
