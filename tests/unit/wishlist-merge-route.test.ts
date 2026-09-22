// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

const { auth } = await import("@/lib/auth");
const { POST } = await import("@/app/api/wishlist/merge/route");
const mockAuth = vi.mocked(auth) as any;

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

describe("POST /api/wishlist/merge", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/wishlist/merge", { method: "POST", body: JSON.stringify({ productIds: [] }) }),
    );

    expect(response.status).toBe(401);
  });

  it("returns 400 for an invalid body", async () => {
    const user = await prisma.user.create({ data: { email: "wl-merge-route-1@test.com" } });
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await POST(
      new Request("http://localhost/api/wishlist/merge", { method: "POST", body: JSON.stringify({ productIds: "not-an-array" }) }),
    );

    expect(response.status).toBe(400);
  });

  it("merges the given product ids into the user's wishlist", async () => {
    const user = await prisma.user.create({ data: { email: "wl-merge-route-2@test.com" } });
    const product = await createProduct({
      sku: "WISH-MERGE-ROUTE-1",
      slug: "wish-merge-route-1",
      name: "Curry Powder",
      status: "Published",
    });
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await POST(
      new Request("http://localhost/api/wishlist/merge", {
        method: "POST",
        body: JSON.stringify({ productIds: [product.id] }),
      }),
    );

    expect(response.status).toBe(200);
    const wishlist = await prisma.wishlist.findUnique({ where: { userId: user.id }, include: { items: true } });
    expect(wishlist?.items).toHaveLength(1);
  });
});
