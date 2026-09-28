// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { Session } from "next-auth";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { POST as postCoupon, DELETE as deleteCoupon } from "@/app/api/cart/coupon/route";
import { addItem, CART_COOKIE_NAME } from "@/services/cart.service";

const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>;

const SKU_PREFIX = "CPN-ROUTE-SKU-";
const CODE_PREFIX = "CPN-ROUTE-";
let sequence = 0;
const DAY_MS = 24 * 60 * 60 * 1000;

async function makeProduct(price = "1000.00") {
  sequence += 1;
  const product = await createProduct({
    sku: `${SKU_PREFIX}${sequence}`,
    slug: `cpn-route-product-${sequence}`,
    name: `Coupon Route Product ${sequence}`,
    status: "Published",
    stockQuantity: 20,
  });
  await prisma.standardPrice.create({ data: { productId: product.id, price } });
  return product;
}

async function makeCoupon(overrides: Partial<Parameters<typeof prisma.coupon.create>[0]["data"]> = {}) {
  sequence += 1;
  return prisma.coupon.create({
    data: {
      code: `${CODE_PREFIX}${sequence}`,
      discountType: "PercentageOff",
      percentOff: "10",
      startDate: new Date(Date.now() - DAY_MS),
      endDate: new Date(Date.now() + DAY_MS),
      ...overrides,
    },
  });
}

function sessionFor(userId: string): Session {
  return { user: { id: userId }, expires: new Date(Date.now() + 60_000).toISOString() } as Session;
}

function postRequest(body: unknown, cookieValue?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  if (cookieValue) headers.set("cookie", `${CART_COOKIE_NAME}=${cookieValue}`);
  return new Request("http://localhost/api/cart/coupon", { method: "POST", headers, body: JSON.stringify(body) });
}

function deleteRequest(cookieValue?: string) {
  const headers = new Headers();
  if (cookieValue) headers.set("cookie", `${CART_COOKIE_NAME}=${cookieValue}`);
  return new Request("http://localhost/api/cart/coupon", { method: "DELETE", headers });
}

beforeEach(() => {
  mockAuth.mockReset();
  mockAuth.mockResolvedValue(null);
});

afterEach(async () => {
  await prisma.couponRedemption.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.coupon.deleteMany({ where: { code: { startsWith: CODE_PREFIX } } });
  await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { contains: "cpn-route-" } } });
});

describe("POST /api/cart/coupon", () => {
  it("applies a valid coupon for a guest cart and returns the discounted summary", async () => {
    const product = await makeProduct();
    const { newCookieValue } = await addItem(null, undefined, product.id, 1);
    const coupon = await makeCoupon();

    const response = await postCoupon(postRequest({ code: coupon.code.toLowerCase() }, newCookieValue!));
    const body = (await response.json()) as { couponCode: string; discount: { amount: number } | null };
    expect(response.status).toBe(200);
    expect(body.couponCode).toBe(coupon.code);
    expect(body.discount?.amount).toBe(100);
  });

  it("400s a malformed code", async () => {
    const response = await postCoupon(postRequest({ code: "a" }));
    expect(response.status).toBe(400);
  });

  it("404s an unknown code with the right error code", async () => {
    const product = await makeProduct();
    const { newCookieValue } = await addItem(null, undefined, product.id, 1);
    const response = await postCoupon(postRequest({ code: "NOPE-NOPE" }, newCookieValue!));
    const body = (await response.json()) as { code: string };
    expect(response.status).toBe(404);
    expect(body.code).toBe("not_found");
  });

  it("409s with a structured shortfall when the minimum order value isn't met", async () => {
    const product = await makeProduct("50.00");
    const { newCookieValue } = await addItem(null, undefined, product.id, 1);
    const coupon = await makeCoupon({ minOrderValue: "1000.00" });

    const response = await postCoupon(postRequest({ code: coupon.code }, newCookieValue!));
    const body = (await response.json()) as { code: string; shortfall: number };
    expect(response.status).toBe(409);
    expect(body.code).toBe("min_order_value_not_met");
    expect(body.shortfall).toBe(950);
  });

  it("applies for an authenticated user's cart", async () => {
    const user = await prisma.user.create({ data: { email: "cpn-route-user@test.com" } });
    mockAuth.mockResolvedValue(sessionFor(user.id));
    const product = await makeProduct();
    await addItem(user.id, undefined, product.id, 1);
    const coupon = await makeCoupon();

    const response = await postCoupon(postRequest({ code: coupon.code }));
    expect(response.status).toBe(200);
  });
});

describe("DELETE /api/cart/coupon", () => {
  it("removes an applied coupon", async () => {
    const product = await makeProduct();
    const { newCookieValue } = await addItem(null, undefined, product.id, 1);
    const coupon = await makeCoupon();
    await postCoupon(postRequest({ code: coupon.code }, newCookieValue!));

    const response = await deleteCoupon(deleteRequest(newCookieValue!));
    const body = (await response.json()) as { couponCode: string | null };
    expect(response.status).toBe(200);
    expect(body.couponCode).toBeNull();
  });

  it("is a no-op (200) when no coupon is applied", async () => {
    const product = await makeProduct();
    const { newCookieValue } = await addItem(null, undefined, product.id, 1);
    const response = await deleteCoupon(deleteRequest(newCookieValue!));
    expect(response.status).toBe(200);
  });
});
