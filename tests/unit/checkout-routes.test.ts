// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { Session } from "next-auth";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { GET as getAddresses } from "@/app/api/checkout/addresses/route";
import { POST as postAddress } from "@/app/api/checkout/address/route";
import { POST as postDelivery } from "@/app/api/checkout/delivery/route";
import { POST as postIntent } from "@/app/api/checkout/payment/intent/route";
import { POST as postConfirm } from "@/app/api/payments/confirm/route";
import { POST as postPlaceOrder } from "@/app/api/checkout/place-order/route";
import { addItem } from "@/services/cart.service";
import { CART_COOKIE_NAME } from "@/services/cart.service";

const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>;

let sequence = 0;

async function makeUser() {
  sequence += 1;
  return prisma.user.create({ data: { email: `chk-route-${sequence}@test.com` } });
}

async function makeProduct() {
  sequence += 1;
  const product = await createProduct({
    sku: `CHK-ROUTE-SKU-${sequence}`,
    slug: `chk-route-product-${sequence}`,
    name: `Checkout Route Product ${sequence}`,
    status: "Published",
    stockQuantity: 10,
    weightGrams: 100,
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

function sessionFor(userId: string) {
  return { user: { id: userId }, expires: new Date(Date.now() + 60_000).toISOString() };
}

function jsonRequest(url: string, body: unknown, cookieValue?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  if (cookieValue) headers.set("cookie", `${CART_COOKIE_NAME}=${cookieValue}`);
  return new Request(url, { method: "POST", headers, body: JSON.stringify(body) });
}

const address = {
  recipientName: "Test Guest",
  phone: "+94 77 123 4567",
  line1: "10 Test Lane",
  city: "Colombo",
};

beforeEach(() => {
  mockAuth.mockReset();
  mockAuth.mockResolvedValue(null);
});

afterEach(async () => {
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.address.deleteMany();
  await prisma.deliveryRate.deleteMany();
  await prisma.deliveryZone.deleteMany();
  await prisma.shippingSetting.deleteMany();
  await prisma.standardPrice.deleteMany();
  await prisma.product.deleteMany({ where: { sku: { startsWith: "CHK-ROUTE-SKU-" } } });
  await prisma.user.deleteMany({ where: { email: { contains: "chk-route-" } } });
});

describe("GET /api/checkout/addresses", () => {
  it("requires authentication", async () => {
    const response = await getAddresses();
    expect(response.status).toBe(401);
  });

  it("lists the caller's saved addresses", async () => {
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));
    await prisma.address.create({ data: { userId: user.id, recipientName: "Me", phone: "+94 77 000 0000", line1: "1 Home Rd", city: "Colombo", isDefault: true } });

    const response = await getAddresses();
    const body = (await response.json()) as { addresses: Array<{ city: string }> };
    expect(response.status).toBe(200);
    expect(body.addresses).toHaveLength(1);
    expect(body.addresses[0].city).toBe("Colombo");
  });
});

describe("POST /api/checkout/address", () => {
  it("rejects an invalid address with 400", async () => {
    const response = await postAddress(jsonRequest("http://localhost/api/checkout/address", { address: { ...address, city: "" }, guestEmail: "g@test.com" }));
    expect(response.status).toBe(400);
  });

  it("requires a guest email for guests", async () => {
    const response = await postAddress(jsonRequest("http://localhost/api/checkout/address", { address }));
    const body = (await response.json()) as { code?: string };
    expect(response.status).toBe(400);
    expect(body.code).toBe("guest_email_required");
  });

  it("saves the address when an authenticated caller asks", async () => {
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await postAddress(jsonRequest("http://localhost/api/checkout/address", { address, save: true }));
    const body = (await response.json()) as { savedAddressId?: string };
    expect(response.status).toBe(200);
    expect(body.savedAddressId).toBeDefined();
    expect(await prisma.address.count({ where: { userId: user.id } })).toBe(1);
  });
});

describe("POST /api/checkout/delivery", () => {
  it("returns the resolution for a guest cart", async () => {
    await makeZone();
    const product = await makeProduct();
    const { newCookieValue } = await addItem(null, undefined, product.id, 2);

    const response = await postDelivery(jsonRequest("http://localhost/api/checkout/delivery", { city: "Colombo" }, newCookieValue!));
    const body = (await response.json()) as { status: string; charge?: number };
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: "ok", charge: 350 });
  });

  it("returns no_zone as a 200 fail-safe resolution, never a silent zero", async () => {
    await makeZone();
    const product = await makeProduct();
    const { newCookieValue } = await addItem(null, undefined, product.id, 2);

    const response = await postDelivery(jsonRequest("http://localhost/api/checkout/delivery", { city: "Jaffna" }, newCookieValue!));
    const body = (await response.json()) as { status: string };
    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "no_zone" });
  });

  it("rejects an empty cart with 409", async () => {
    await makeZone();
    const response = await postDelivery(jsonRequest("http://localhost/api/checkout/delivery", { city: "Colombo" }));
    expect(response.status).toBe(409);
  });
});

describe("checkout payment + place-order flow", () => {
  async function guestCheckoutThroughPayment(outcome: "success" | "decline") {
    await makeZone();
    const product = await makeProduct();
    const { newCookieValue } = await addItem(null, undefined, product.id, 2);
    const cookie = newCookieValue!;

    const intentResponse = await postIntent(jsonRequest("http://localhost/api/checkout/payment/intent", { city: "Colombo" }, cookie));
    const intent = (await intentResponse.json()) as { providerReference: string; amount: number };
    expect(intentResponse.status).toBe(200);
    expect(intent.amount).toBe(2350);

    const confirmResponse = await postConfirm(jsonRequest("http://localhost/api/payments/confirm", { providerReference: intent.providerReference, outcome }));
    return { cookie, product, intent, confirmResponse };
  }

  it("completes the guest happy path and returns 201 with the order number", async () => {
    const { cookie, intent, confirmResponse } = await guestCheckoutThroughPayment("success");
    expect(((await confirmResponse.json()) as { status: string }).status).toBe("Succeeded");

    const response = await postPlaceOrder(
      jsonRequest(
        "http://localhost/api/checkout/place-order",
        { idempotencyKey: crypto.randomUUID(), address, guestEmail: "guest@test.com", providerReference: intent.providerReference },
        cookie,
      ),
    );
    const body = (await response.json()) as { orderNumber: string; replayed: boolean };
    expect(response.status).toBe(201);
    expect(body.orderNumber).toMatch(/^ORS-/);
    expect(body.replayed).toBe(false);
  });

  it("returns 200 (not 201) for an idempotent replay", async () => {
    const { cookie, intent } = await guestCheckoutThroughPayment("success");
    const idempotencyKey = crypto.randomUUID();
    const payload = { idempotencyKey, address, guestEmail: "guest@test.com", providerReference: intent.providerReference };

    const first = await postPlaceOrder(jsonRequest("http://localhost/api/checkout/place-order", payload, cookie));
    expect(first.status).toBe(201);

    const retry = await postPlaceOrder(jsonRequest("http://localhost/api/checkout/place-order", payload, cookie));
    const retryBody = (await retry.json()) as { orderNumber: string; replayed: boolean };
    expect(retry.status).toBe(200);
    expect(retryBody.replayed).toBe(true);
  });

  it("blocks place-order behind a declined payment with 402", async () => {
    const { cookie, intent, confirmResponse } = await guestCheckoutThroughPayment("decline");
    expect(((await confirmResponse.json()) as { status: string }).status).toBe("Failed");

    const response = await postPlaceOrder(
      jsonRequest(
        "http://localhost/api/checkout/place-order",
        { idempotencyKey: crypto.randomUUID(), address, guestEmail: "guest@test.com", providerReference: intent.providerReference },
        cookie,
      ),
    );
    expect(response.status).toBe(402);
  });

  it("returns 504 for a mock provider timeout, leaving the payment retryable", async () => {
    await makeZone();
    const product = await makeProduct();
    const { newCookieValue } = await addItem(null, undefined, product.id, 1);

    const intentResponse = await postIntent(jsonRequest("http://localhost/api/checkout/payment/intent", { city: "Colombo" }, newCookieValue!));
    const intent = (await intentResponse.json()) as { providerReference: string };

    const timeoutResponse = await postConfirm(jsonRequest("http://localhost/api/payments/confirm", { providerReference: intent.providerReference, outcome: "timeout" }));
    expect(timeoutResponse.status).toBe(504);

    const retryResponse = await postConfirm(jsonRequest("http://localhost/api/payments/confirm", { providerReference: intent.providerReference, outcome: "success" }));
    expect(((await retryResponse.json()) as { status: string }).status).toBe("Succeeded");
  });
});
