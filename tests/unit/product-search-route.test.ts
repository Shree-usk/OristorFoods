// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { createStandardPrice } from "@/repositories/pricing.repository";
import { GET } from "@/app/api/products/search/route";

afterEach(async () => {
  await prisma.product.deleteMany();
});

describe("GET /api/products/search", () => {
  it("returns matching published products for a query", async () => {
    const product = await createProduct({
      sku: "ROUTE-SEARCH-1",
      slug: "route-search-curry",
      name: "Curry Powder",
      status: "Published",
    });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "450.00" });

    const response = await GET(new Request("http://localhost/api/products/search?q=curry"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items.map((p: { name: string }) => p.name)).toEqual(["Curry Powder"]);
  });

  it("returns an empty result for a blank query, not an error", async () => {
    const response = await GET(new Request("http://localhost/api/products/search?q="));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toEqual([]);
  });

  it("respects filters and sort query params", async () => {
    const a = await createProduct({
      sku: "ROUTE-SEARCH-2",
      slug: "route-search-a",
      name: "Curry A",
      status: "Published",
      publishedAt: new Date("2026-01-01"),
    });
    const b = await createProduct({
      sku: "ROUTE-SEARCH-3",
      slug: "route-search-b",
      name: "Curry B",
      status: "Published",
      publishedAt: new Date("2026-06-01"),
    });
    await createStandardPrice({ product: { connect: { id: a.id } }, price: "100.00" });
    await createStandardPrice({ product: { connect: { id: b.id } }, price: "100.00" });

    const response = await GET(new Request("http://localhost/api/products/search?q=curry&sort=newest"));
    const body = await response.json();

    expect(body.items.map((p: { name: string }) => p.name)).toEqual(["Curry B", "Curry A"]);
  });
});
