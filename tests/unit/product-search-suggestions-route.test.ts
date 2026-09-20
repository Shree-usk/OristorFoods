// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { GET } from "@/app/api/products/search/suggestions/route";

afterEach(async () => {
  await prisma.product.deleteMany();
});

describe("GET /api/products/search/suggestions", () => {
  it("returns top suggestions for a query", async () => {
    await createProduct({
      sku: "SUGG-ROUTE-1",
      slug: "sugg-route-curry",
      name: "Curry Powder",
      status: "Published",
    });

    const response = await GET(new Request("http://localhost/api/products/search/suggestions?q=curry"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.map((s: { label: string }) => s.label)).toEqual(["Curry Powder"]);
  });

  it("returns an empty array for a blank query", async () => {
    const response = await GET(new Request("http://localhost/api/products/search/suggestions?q="));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([]);
  });
});
