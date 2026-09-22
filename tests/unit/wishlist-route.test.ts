// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { createStandardPrice } from "@/repositories/pricing.repository";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

const { auth } = await import("@/lib/auth");
const { GET, POST } = await import("@/app/api/wishlist/route");
const mockAuth = vi.mocked(auth) as any;

function sessionFor(userId: string): Session {
  return { user: { id: userId, name: null, email: null, image: null }, expires: "2099-01-01T00:00:00.000Z" };
}

afterEach(async () => {
  await prisma.wishlistItem.deleteMany();
  await prisma.wishlist.deleteMany();
  await prisma.standardPrice.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
  vi.clearAllMocks();
});

describe("GET /api/wishlist", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("returns the current user's wishlist items", async () => {
    const user = await prisma.user.create({ data: { email: "wl-route-1@test.com" } });
    const product = await createProduct({
      sku: "WISH-ROUTE-1",
      slug: "wish-route-1",
      name: "Curry Powder",
      status: "Published",
    });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "450.00" });
    await prisma.wishlist.create({ data: { userId: user.id, items: { create: { productId: product.id } } } });
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].name).toBe("Curry Powder");
  });
});

describe("POST /api/wishlist", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await POST(new Request("http://localhost/api/wishlist", { method: "POST", body: "{}" }));

    expect(response.status).toBe(401);
  });

  it("returns 400 for an invalid body", async () => {
    const user = await prisma.user.create({ data: { email: "wl-route-2@test.com" } });
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await POST(new Request("http://localhost/api/wishlist", { method: "POST", body: "{}" }));

    expect(response.status).toBe(400);
  });

  it("adds a product to the wishlist", async () => {
    const user = await prisma.user.create({ data: { email: "wl-route-3@test.com" } });
    const product = await createProduct({
      sku: "WISH-ROUTE-2",
      slug: "wish-route-2",
      name: "Chili Paste",
      status: "Published",
    });
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await POST(
      new Request("http://localhost/api/wishlist", {
        method: "POST",
        body: JSON.stringify({ productId: product.id }),
      }),
    );

    expect(response.status).toBe(200);
    const wishlist = await prisma.wishlist.findUnique({ where: { userId: user.id }, include: { items: true } });
    expect(wishlist?.items).toHaveLength(1);
  });
});
