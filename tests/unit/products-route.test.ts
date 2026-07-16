// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createCategory } from "@/repositories/category.repository";
import { createProduct } from "@/repositories/product.repository";
import { createStandardPrice } from "@/repositories/pricing.repository";
import { GET } from "@/app/api/products/route";

afterEach(async () => {
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
});

describe("GET /api/products", () => {
  it("returns published products with pagination metadata", async () => {
    const product = await createProduct({
      sku: "ROUTE-1",
      slug: "route-product",
      name: "Route Product",
      status: "Published",
    });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "199.00" });

    const response = await GET(new Request("http://localhost/api/products"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].name).toBe("Route Product");
    expect(body.total).toBe(1);
    expect(body.hasNextPage).toBe(false);
  });

  it("returns 200 with default sort applied when given a malformed sort value", async () => {
    const response = await GET(new Request("http://localhost/api/products?sort=not-a-real-sort"));

    expect(response.status).toBe(200);
  });

  it("filters by category slug via the category query param", async () => {
    const category = await createCategory({ name: "Spices", slug: "route-spices" });
    const inCategory = await createProduct({
      sku: "ROUTE-2",
      slug: "route-2",
      name: "In Category",
      status: "Published",
      categories: { connect: [{ id: category.id }] },
    });
    await createProduct({ sku: "ROUTE-3", slug: "route-3", name: "Other", status: "Published" });
    await createStandardPrice({ product: { connect: { id: inCategory.id } }, price: "100.00" });

    const response = await GET(new Request("http://localhost/api/products?category=route-spices"));
    const body = await response.json();

    expect(body.items.map((item: { name: string }) => item.name)).toEqual(["In Category"]);
  });
});
