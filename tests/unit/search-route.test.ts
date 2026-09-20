// tests/unit/search-route.test.ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { createStandardPrice } from "@/repositories/pricing.repository";
import { GET } from "@/app/api/search/route";

afterEach(async () => {
  await prisma.product.deleteMany();
});

describe("GET /api/search", () => {
  it("returns matching published products for a query", async () => {
    const product = await createProduct({
      sku: "SEARCH-ROUTE-1",
      slug: "search-route-curry",
      name: "Roasted Curry Powder",
      status: "Published",
    });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "450.00" });

    const response = await GET(new Request("http://localhost/api/search?q=curry"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.products.map((p: { name: string }) => p.name)).toEqual(["Roasted Curry Powder"]);
  });

  it("returns an empty result for a blank query, not an error", async () => {
    const response = await GET(new Request("http://localhost/api/search?q="));
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

    const response = await GET(new Request("http://localhost/api/search?q=curry&pageSize=2"));
    const body = await response.json();

    expect(body.products).toHaveLength(2);
    expect(body.hasNextPage).toBe(true);
  });
});
