// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { Session } from "next-auth";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

const { auth } = await import("@/lib/auth");
const { DELETE } = await import("@/app/api/wishlist/[productId]/route");
const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>;

function sessionFor(userId: string): Session {
  return { user: { id: userId, name: null, email: null, image: null }, expires: "2099-01-01T00:00:00.000Z" };
}

afterEach(async () => {
  await prisma.wishlistItem.deleteMany();
  await prisma.wishlist.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
  vi.clearAllMocks();
});

describe("DELETE /api/wishlist/[productId]", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await DELETE(new Request("http://localhost/api/wishlist/p1", { method: "DELETE" }), {
      params: Promise.resolve({ productId: "p1" }),
    });

    expect(response.status).toBe(401);
  });

  it("removes the product from the user's wishlist", async () => {
    const user = await prisma.user.create({ data: { email: "wl-item-route-1@test.com" } });
    const product = await createProduct({
      sku: "WISH-ITEM-ROUTE-1",
      slug: "wish-item-route-1",
      name: "Ginger Powder",
      status: "Published",
    });
    await prisma.wishlist.create({ data: { userId: user.id, items: { create: { productId: product.id } } } });
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await DELETE(
      new Request(`http://localhost/api/wishlist/${product.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ productId: product.id }) },
    );

    expect(response.status).toBe(200);
    const wishlist = await prisma.wishlist.findUnique({ where: { userId: user.id }, include: { items: true } });
    expect(wishlist?.items).toHaveLength(0);
  });
});
