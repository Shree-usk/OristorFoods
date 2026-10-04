// tests/unit/search-autocomplete-route.test.ts
// STORY-061. This exact keyword-only, unchanged-searchCatalogue behavior
// moved from GET /api/search to GET /api/search/autocomplete — the
// low-latency path the overlay calls on every keystroke. GET /api/search
// now calls the semantic-blended getSmartSearchResults instead (see
// smart-search-service.test.ts and smart-search-route.test.ts).
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
const { GET } = await import("@/app/api/search/autocomplete/route");
const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>;

beforeEach(() => {
  mockAuth.mockResolvedValue(null);
});

afterEach(async () => {
  await prisma.product.deleteMany();
  vi.clearAllMocks();
});

describe("GET /api/search/autocomplete", () => {
  it("returns matching published products for a query", async () => {
    const product = await createProduct({
      sku: "SEARCH-ROUTE-1",
      slug: "search-route-curry",
      name: "Roasted Curry Powder",
      status: "Published",
    });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "450.00" });

    const response = await GET(new Request("http://localhost/api/search/autocomplete?q=curry"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.products.map((p: { name: string }) => p.name)).toEqual(["Roasted Curry Powder"]);
  });

  it("returns an empty result for a blank query, not an error", async () => {
    const response = await GET(new Request("http://localhost/api/search/autocomplete?q="));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.products).toEqual([]);
  });

  it("respects an explicit pageSize override", async () => {
    for (let i = 0; i < 3; i++) {
      const product = await createProduct({
        sku: `SEARCH-ROUTE-PS-${i}`,
        slug: `search-route-ps-${i}`,
        name: `Curry Page ${i}`,
        status: "Published",
      });
      await createStandardPrice({ product: { connect: { id: product.id } }, price: "100.00" });
    }

    const response = await GET(new Request("http://localhost/api/search/autocomplete?q=curry&pageSize=2"));
    const body = await response.json();

    expect(body.products).toHaveLength(2);
    expect(body.hasNextPage).toBe(true);
  });
});
