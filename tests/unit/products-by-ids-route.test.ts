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
const { GET } = await import("@/app/api/products/by-ids/route");
const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>;

beforeEach(() => {
  mockAuth.mockResolvedValue(null);
});

afterEach(async () => {
  await prisma.standardPrice.deleteMany();
  await prisma.product.deleteMany();
  vi.clearAllMocks();
});

describe("GET /api/products/by-ids", () => {
  it("returns products matching the given ids", async () => {
    const product = await createProduct({
      sku: "BY-IDS-1",
      slug: "by-ids-1",
      name: "Curry Powder",
      status: "Published",
    });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "450.00" });

    const response = await GET(new Request(`http://localhost/api/products/by-ids?ids=${product.id}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe(product.id);
  });

  it("returns an empty list for a blank ids param", async () => {
    const response = await GET(new Request("http://localhost/api/products/by-ids?ids="));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toEqual([]);
  });

  it("silently drops unpublished products", async () => {
    const product = await createProduct({
      sku: "BY-IDS-2",
      slug: "by-ids-2",
      name: "Draft Product",
      status: "Draft",
    });

    const response = await GET(new Request(`http://localhost/api/products/by-ids?ids=${product.id}`));
    const body = await response.json();

    expect(body.items).toEqual([]);
  });
});
