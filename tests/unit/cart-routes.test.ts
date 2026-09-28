// tests/unit/cart-routes.test.ts
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { Session } from "next-auth";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { GET as getCartRoute } from "@/app/api/cart/route";
import { POST as postCartItem } from "@/app/api/cart/items/route";
import { PATCH as patchCartItem, DELETE as deleteCartItem } from "@/app/api/cart/items/[id]/route";
import { POST as postCartMerge } from "@/app/api/cart/merge/route";
import { CART_COOKIE_NAME } from "@/services/cart.service";

const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>;

let sequence = 0;

async function makeUser() {
  sequence += 1;
  return prisma.user.create({ data: { email: `cart-route-${sequence}@test.com` } });
}

async function makeProduct(overrides: Record<string, unknown> = {}) {
  sequence += 1;
  const product = await createProduct({
    sku: `CART-ROUTE-SKU-${sequence}`,
    slug: `cart-route-product-${sequence}`,
    name: `Cart Route Product ${sequence}`,
    status: "Published",
    stockQuantity: 10,
    ...overrides,
  });
  await prisma.standardPrice.create({ data: { productId: product.id, price: "15.00" } });
  return product;
}

function sessionFor(userId: string) {
  return { user: { id: userId }, expires: new Date(Date.now() + 60_000).toISOString() };
}

function requestWithCookie(url: string, cookieValue?: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (cookieValue) headers.set("cookie", `${CART_COOKIE_NAME}=${cookieValue}`);
  return new Request(url, { ...init, headers });
}

function cookieValueFrom(response: Response): string | undefined {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) return undefined;
  const match = setCookie.match(new RegExp(`${CART_COOKIE_NAME}=([^;]+)`));
  return match?.[1];
}

beforeEach(() => {
  mockAuth.mockReset();
  mockAuth.mockResolvedValue(null);
});

afterEach(async () => {
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.standardPrice.deleteMany();
  await prisma.product.deleteMany({ where: { sku: { startsWith: "CART-ROUTE-SKU-" } } });
  await prisma.user.deleteMany({ where: { email: { contains: "cart-route-" } } });
});

describe("GET /api/cart", () => {
  it("returns an empty cart and sets a guest cookie for a first-time visitor", async () => {
    const response = await getCartRoute(new Request("http://localhost/api/cart"));
    const body = (await response.json()) as { items: unknown[] };

    expect(response.status).toBe(200);
    expect(body.items).toEqual([]);
    expect(cookieValueFrom(response)).toBeDefined();
  });

  it("reuses the same guest cart across requests with the cookie", async () => {
    const first = await getCartRoute(new Request("http://localhost/api/cart"));
    const cookieValue = cookieValueFrom(first)!;

    const product = await makeProduct();
    await postCartItem(requestWithCookie("http://localhost/api/cart/items", cookieValue, { method: "POST", body: JSON.stringify({ productId: product.id, quantity: 1 }), headers: { "Content-Type": "application/json" } }));

    const second = await getCartRoute(requestWithCookie("http://localhost/api/cart", cookieValue));
    const body = (await second.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(1);
  });

  it("creates exactly one guest Cart row for a first-time visitor, not two", async () => {
    const before = await prisma.cart.count();
    await getCartRoute(new Request("http://localhost/api/cart"));
    const after = await prisma.cart.count();
    expect(after - before).toBe(1);
  });
});

describe("POST /api/cart/items", () => {
  it("adds an item as a guest", async () => {
    const product = await makeProduct();
    const response = await postCartItem(
      new Request("http://localhost/api/cart/items", {
        method: "POST",
        body: JSON.stringify({ productId: product.id, quantity: 2 }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(response.status).toBe(200);
    expect(cookieValueFrom(response)).toBeDefined();
  });

  it("returns 409 with availableQuantity when the quantity exceeds stock", async () => {
    const product = await makeProduct({ stockQuantity: 2 });
    const response = await postCartItem(
      new Request("http://localhost/api/cart/items", {
        method: "POST",
        body: JSON.stringify({ productId: product.id, quantity: 5 }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    const body = (await response.json()) as { availableQuantity: number };
    expect(response.status).toBe(409);
    expect(body.availableQuantity).toBe(2);
  });

  it("returns 400 for an invalid body", async () => {
    const response = await postCartItem(
      new Request("http://localhost/api/cart/items", { method: "POST", body: JSON.stringify({ quantity: -1 }), headers: { "Content-Type": "application/json" } }),
    );
    expect(response.status).toBe(400);
  });

  it("adds to the authenticated user's cart when a session exists", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    mockAuth.mockResolvedValue(sessionFor(user.id));

    await postCartItem(
      new Request("http://localhost/api/cart/items", { method: "POST", body: JSON.stringify({ productId: product.id, quantity: 1 }), headers: { "Content-Type": "application/json" } }),
    );

    const response = await getCartRoute(new Request("http://localhost/api/cart"));
    const body = (await response.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(1);
  });
});

describe("PATCH /api/cart/items/[id]", () => {
  it("updates quantity for the owning guest cart", async () => {
    const product = await makeProduct();
    const addResponse = await postCartItem(
      new Request("http://localhost/api/cart/items", { method: "POST", body: JSON.stringify({ productId: product.id, quantity: 1 }), headers: { "Content-Type": "application/json" } }),
    );
    const cookieValue = cookieValueFrom(addResponse)!;
    const cartResponse = await getCartRoute(requestWithCookie("http://localhost/api/cart", cookieValue));
    const { items } = (await cartResponse.json()) as { items: { id: string }[] };

    const response = await patchCartItem(
      requestWithCookie(`http://localhost/api/cart/items/${items[0]!.id}`, cookieValue, { method: "PATCH", body: JSON.stringify({ quantity: 3 }), headers: { "Content-Type": "application/json" } }),
      { params: Promise.resolve({ id: items[0]!.id }) },
    );
    expect(response.status).toBe(200);
  });

  it("returns 403 when the item belongs to a different guest cart", async () => {
    const product = await makeProduct();
    const addResponse = await postCartItem(
      new Request("http://localhost/api/cart/items", { method: "POST", body: JSON.stringify({ productId: product.id, quantity: 1 }), headers: { "Content-Type": "application/json" } }),
    );
    const ownerCookie = cookieValueFrom(addResponse)!;
    const ownerCart = await getCartRoute(requestWithCookie("http://localhost/api/cart", ownerCookie));
    const { items } = (await ownerCart.json()) as { items: { id: string }[] };

    // A different guest (no cookie) tries to patch the first guest's item.
    const response = await patchCartItem(
      new Request(`http://localhost/api/cart/items/${items[0]!.id}`, { method: "PATCH", body: JSON.stringify({ quantity: 3 }), headers: { "Content-Type": "application/json" } }),
      { params: Promise.resolve({ id: items[0]!.id }) },
    );
    expect(response.status).toBe(403);
  });
});

describe("DELETE /api/cart/items/[id]", () => {
  it("removes the item for the owning cart", async () => {
    const product = await makeProduct();
    const addResponse = await postCartItem(
      new Request("http://localhost/api/cart/items", { method: "POST", body: JSON.stringify({ productId: product.id, quantity: 1 }), headers: { "Content-Type": "application/json" } }),
    );
    const cookieValue = cookieValueFrom(addResponse)!;
    const cartResponse = await getCartRoute(requestWithCookie("http://localhost/api/cart", cookieValue));
    const { items } = (await cartResponse.json()) as { items: { id: string }[] };

    const response = await deleteCartItem(requestWithCookie(`http://localhost/api/cart/items/${items[0]!.id}`, cookieValue, { method: "DELETE" }), {
      params: Promise.resolve({ id: items[0]!.id }),
    });
    expect(response.status).toBe(204);
  });

  it("returns 404 for a nonexistent item id", async () => {
    const response = await deleteCartItem(new Request("http://localhost/api/cart/items/does-not-exist", { method: "DELETE" }), {
      params: Promise.resolve({ id: "does-not-exist" }),
    });
    expect(response.status).toBe(404);
  });
});

describe("POST /api/cart/merge", () => {
  it("requires authentication", async () => {
    const response = await postCartMerge(new Request("http://localhost/api/cart/merge", { method: "POST" }));
    expect(response.status).toBe(401);
  });

  it("merges the guest cart identified by the request's cookie into the authenticated user's cart", async () => {
    const product = await makeProduct();
    const addResponse = await postCartItem(
      new Request("http://localhost/api/cart/items", { method: "POST", body: JSON.stringify({ productId: product.id, quantity: 2 }), headers: { "Content-Type": "application/json" } }),
    );
    const guestCookie = cookieValueFrom(addResponse)!;

    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await postCartMerge(requestWithCookie("http://localhost/api/cart/merge", guestCookie, { method: "POST" }));
    expect(response.status).toBe(200);

    const cartResponse = await getCartRoute(new Request("http://localhost/api/cart"));
    const body = (await cartResponse.json()) as { items: { quantity: number }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.quantity).toBe(2);
  });
});
