// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createBrand } from "@/repositories/brand.repository";
import { createCategory } from "@/repositories/category.repository";
import {
  createProduct,
  findProductById,
  findProductBySku,
  findProductBySlug,
  listProductsByCategory,
  listProductsByStatus,
} from "@/repositories/product.repository";

afterEach(async () => {
  await prisma.product.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.category.deleteMany();
});

describe("product.repository", () => {
  it("creates a product and finds it by slug and sku", async () => {
    await createProduct({
      sku: "ORI-CP-100",
      slug: "curry-powder-100g",
      name: "Roasted Curry Powder 100g",
      status: "Published",
    });

    expect((await findProductBySlug("curry-powder-100g"))?.sku).toBe("ORI-CP-100");
    expect((await findProductBySku("ORI-CP-100"))?.slug).toBe("curry-powder-100g");
  });

  it("rejects a duplicate SKU", async () => {
    await createProduct({ sku: "ORI-CP-100", slug: "curry-powder-100g", name: "A" });

    await expect(
      createProduct({ sku: "ORI-CP-100", slug: "different-slug", name: "B" }),
    ).rejects.toThrow();
  });

  it("links to a brand and category, and both list back", async () => {
    const brand = await createBrand({ name: "Oristor", slug: "oristor" });
    const category = await createCategory({ name: "Curry Powders", slug: "curry-powders" });

    await createProduct({
      sku: "ORI-CP-100",
      slug: "curry-powder-100g",
      name: "Roasted Curry Powder 100g",
      status: "Published",
      brand: { connect: { id: brand.id } },
      categories: { connect: [{ id: category.id }] },
    });

    const byCategory = await listProductsByCategory(category.id);
    const byStatus = await listProductsByStatus("Published");

    expect(byCategory.map((p) => p.slug)).toEqual(["curry-powder-100g"]);
    expect(byStatus.map((p) => p.slug)).toEqual(["curry-powder-100g"]);
  });

  it("defaults inStock to true and can be created as out of stock", async () => {
    const inStockProduct = await createProduct({ sku: "STOCK-1", slug: "stock-1", name: "In Stock" });
    const outOfStockProduct = await createProduct({
      sku: "STOCK-2",
      slug: "stock-2",
      name: "Out of Stock",
      inStock: false,
    });

    expect((await findProductById(inStockProduct.id))?.inStock).toBe(true);
    expect((await findProductById(outOfStockProduct.id))?.inStock).toBe(false);
  });
});
