// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { createStandardPrice } from "@/repositories/pricing.repository";
import { GET } from "@/app/api/products/compare/route";

afterEach(async () => {
  await prisma.standardPrice.deleteMany();
  await prisma.product.deleteMany();
});

describe("GET /api/products/compare", () => {
  it("returns comparison data for valid ids", async () => {
    const product = await createProduct({
      sku: "COMPARE-ROUTE-1",
      slug: "compare-route-1",
      name: "Curry Powder",
      status: "Published",
    });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "450.00" });

    const response = await GET(new Request(`http://localhost/api/products/compare?ids=${product.id}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe(product.id);
  });

  it("returns 400 for a missing ids param", async () => {
    const response = await GET(new Request("http://localhost/api/products/compare"));

    expect(response.status).toBe(400);
  });

  it("returns 400 for more than 4 ids", async () => {
    const response = await GET(
      new Request("http://localhost/api/products/compare?ids=p1,p2,p3,p4,p5"),
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 for a blank ids param", async () => {
    const response = await GET(new Request("http://localhost/api/products/compare?ids="));

    expect(response.status).toBe(400);
  });
});
