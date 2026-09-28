// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { Session } from "next-auth";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import type { CreateOrderInput } from "@/repositories/order.repository";
import { GET as getOrders } from "@/app/api/orders/route";
import { GET as getOrderDetail } from "@/app/api/orders/[orderNumber]/route";
import { POST as postCancel } from "@/app/api/orders/[orderNumber]/cancel/route";
import { addItem, CART_COOKIE_NAME } from "@/services/cart.service";
import { createOrder, transitionOrderStatus } from "@/services/order.service";

const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>;

let sequence = 0;

async function makeUser() {
  sequence += 1;
  return prisma.user.create({ data: { email: `ord-route-${sequence}@test.com` } });
}

async function makeProduct(stockQuantity = 10) {
  sequence += 1;
  return createProduct({
    sku: `ORD-ROUTE-SKU-${sequence}`,
    slug: `ord-route-product-${sequence}`,
    name: `Order Route Product ${sequence}`,
    status: "Published",
    stockQuantity,
  });
}

async function makePayment(amount: string) {
  sequence += 1;
  return prisma.payment.create({
    data: { provider: "mock", providerReference: `mock_ord-route-${sequence}`, status: "Succeeded", amount, currency: "LKR" },
  });
}

function orderInput(
  overrides: Partial<Omit<CreateOrderInput, "orderNumber">> & Pick<Omit<CreateOrderInput, "orderNumber">, "idempotencyKey" | "paymentId" | "cartId" | "items">,
): Omit<CreateOrderInput, "orderNumber"> {
  return {
    userId: null,
    guestToken: null,
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

/** A real guest cart + signed cookie, via cart.service.ts — the same identity mechanism the real routes verify against. */
async function placeGuestOrder() {
  const product = await makeProduct();
  const payment = await makePayment("150.00");
  const { cart, newCookieValue } = await addItem(null, undefined, product.id, 2);
  const { order } = await createOrder(
    orderInput({ idempotencyKey: crypto.randomUUID(), guestToken: cart.guestToken, paymentId: payment.id, cartId: cart.id, items: [lineFor(product, 2)] }),
  );
  return { order, product, payment, cookieValue: newCookieValue! };
}

async function placeUserOrder(userId: string) {
  const product = await makeProduct();
  const payment = await makePayment("150.00");
  const cart = await prisma.cart.create({ data: { userId } });
  const { order } = await createOrder(
    orderInput({ idempotencyKey: crypto.randomUUID(), userId, guestToken: null, paymentId: payment.id, cartId: cart.id, items: [lineFor(product, 2)] }),
  );
  return { order, product, payment };
}

function sessionFor(userId: string): Session {
  return { user: { id: userId }, expires: new Date(Date.now() + 60_000).toISOString() } as Session;
}

function getRequest(url: string, cookieValue?: string) {
  const headers = new Headers();
  if (cookieValue) headers.set("cookie", `${CART_COOKIE_NAME}=${cookieValue}`);
  return new Request(url, { headers });
}

function postRequest(url: string, body: unknown, cookieValue?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  if (cookieValue) headers.set("cookie", `${CART_COOKIE_NAME}=${cookieValue}`);
  return new Request(url, { method: "POST", headers, body: JSON.stringify(body) });
}

beforeEach(() => {
  mockAuth.mockReset();
  mockAuth.mockResolvedValue(null);
});

afterEach(async () => {
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.payment.deleteMany({ where: { providerReference: { startsWith: "mock_ord-route-" } } });
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.product.deleteMany({ where: { sku: { startsWith: "ORD-ROUTE-SKU-" } } });
  await prisma.user.deleteMany({ where: { email: { contains: "ord-route-" } } });
});

describe("GET /api/orders", () => {
  it("requires authentication", async () => {
    const response = await getOrders(getRequest("http://localhost/api/orders"));
    expect(response.status).toBe(401);
  });

  it("lists only the authenticated user's orders, paginated", async () => {
    const user = await makeUser();
    const stranger = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));
    await placeUserOrder(user.id);
    await placeUserOrder(stranger.id);

    const response = await getOrders(getRequest("http://localhost/api/orders?page=1&pageSize=20"));
    const body = (await response.json()) as { orders: Array<{ orderNumber: string }>; total: number; page: number; pageSize: number };
    expect(response.status).toBe(200);
    expect(body.orders).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
  });

  it("falls back to sane defaults for a malformed page/pageSize", async () => {
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await getOrders(getRequest("http://localhost/api/orders?page=not-a-number"));
    const body = (await response.json()) as { page: number; pageSize: number };
    expect(response.status).toBe(200);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(20);
  });
});

describe("GET /api/orders/:orderNumber", () => {
  it("returns the order for its owning guest, including status history", async () => {
    const { order, cookieValue } = await placeGuestOrder();
    const response = await getOrderDetail(getRequest(`http://localhost/api/orders/${order.orderNumber}`, cookieValue), {
      params: Promise.resolve({ orderNumber: order.orderNumber }),
    });
    const body = (await response.json()) as { orderNumber: string; statusHistory: unknown[] };
    expect(response.status).toBe(200);
    expect(body.orderNumber).toBe(order.orderNumber);
    expect(body.statusHistory).toHaveLength(1);
  });

  it("403s for a stranger and 404s for an unknown order number", async () => {
    const { order } = await placeGuestOrder();
    const forbidden = await getOrderDetail(getRequest(`http://localhost/api/orders/${order.orderNumber}`), {
      params: Promise.resolve({ orderNumber: order.orderNumber }),
    });
    expect(forbidden.status).toBe(403);

    const notFound = await getOrderDetail(getRequest("http://localhost/api/orders/ORS-00000000-000000"), {
      params: Promise.resolve({ orderNumber: "ORS-00000000-000000" }),
    });
    expect(notFound.status).toBe(404);
  });
});

describe("POST /api/orders/:orderNumber/cancel", () => {
  it("cancels an eligible order for its owning guest", async () => {
    const { order, cookieValue } = await placeGuestOrder();
    const response = await postCancel(postRequest(`http://localhost/api/orders/${order.orderNumber}/cancel`, { reason: "Testing" }, cookieValue), {
      params: Promise.resolve({ orderNumber: order.orderNumber }),
    });
    const body = (await response.json()) as { status: string; refundOutcome: string };
    expect(response.status).toBe(200);
    expect(body.status).toBe("Cancelled");
    expect(body.refundOutcome).toBe("refunded");
  });

  it("409s once the order has moved past the cancellable window", async () => {
    const { order, cookieValue } = await placeGuestOrder();
    await transitionOrderStatus(order.id, "Processing", "system:test");
    await transitionOrderStatus(order.id, "Dispatched", "system:test");

    const response = await postCancel(postRequest(`http://localhost/api/orders/${order.orderNumber}/cancel`, {}, cookieValue), {
      params: Promise.resolve({ orderNumber: order.orderNumber }),
    });
    expect(response.status).toBe(409);
  });

  it("403s for a stranger's cancellation attempt", async () => {
    const { order } = await placeGuestOrder();
    const response = await postCancel(postRequest(`http://localhost/api/orders/${order.orderNumber}/cancel`, {}), {
      params: Promise.resolve({ orderNumber: order.orderNumber }),
    });
    expect(response.status).toBe(403);
  });

  it("400s a reason longer than 500 characters", async () => {
    const { order, cookieValue } = await placeGuestOrder();
    const response = await postCancel(
      postRequest(`http://localhost/api/orders/${order.orderNumber}/cancel`, { reason: "x".repeat(501) }, cookieValue),
      { params: Promise.resolve({ orderNumber: order.orderNumber }) },
    );
    expect(response.status).toBe(400);
  });
});
