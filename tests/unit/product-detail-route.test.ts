// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { Session } from "next-auth";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { createStandardPrice } from "@/repositories/pricing.repository";

// STORY-071: see products-route.test.ts's comment — mocked as signed-out.
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

const { auth } = await import("@/lib/auth");
const { GET } = await import("@/app/api/products/[slug]/route");
const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>;

beforeEach(() => {
  mockAuth.mockResolvedValue(null);
});

afterEach(async () => {
  await prisma.product.deleteMany();
  vi.clearAllMocks();
});

describe("GET /api/products/[slug]", () => {
  it("returns the product detail payload for a published product", async () => {
    const product = await createProduct({
      sku: "DETAIL-ROUTE-1",
      slug: "detail-route-product",
      name: "Detail Route Product",
      status: "Published",
    });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "450.00" });

    const response = await GET(new Request("http://localhost/api/products/detail-route-product"), {
      params: Promise.resolve({ slug: "detail-route-product" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.name).toBe("Detail Route Product");
    expect(body.price).toBe(450);
  });

  it("returns 404 for an unknown slug", async () => {
    const response = await GET(new Request("http://localhost/api/products/does-not-exist"), {
      params: Promise.resolve({ slug: "does-not-exist" }),
    });

    expect(response.status).toBe(404);
  });
});
