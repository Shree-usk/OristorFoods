// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { createStandardPrice } from "@/repositories/pricing.repository";
import { GET } from "@/app/api/products/[slug]/route";

afterEach(async () => {
  await prisma.product.deleteMany();
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
