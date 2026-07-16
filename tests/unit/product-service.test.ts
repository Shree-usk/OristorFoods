// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createCategory } from "@/repositories/category.repository";
import { createCollection } from "@/repositories/collection.repository";
import { createStandardPrice } from "@/repositories/pricing.repository";
import { createProduct } from "@/repositories/product.repository";
import { getProductBySlug, getProductBySlugForAdmin, listProducts } from "@/services/product.service";

afterEach(async () => {
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.collection.deleteMany();
});

describe("product.service", () => {
  it("returns a published product to storefront callers", async () => {
    await createProduct({
      sku: "SKU-1",
      slug: "curry-powder",
      name: "Curry Powder",
      status: "Published",
    });

    const found = await getProductBySlug("curry-powder");

    expect(found?.slug).toBe("curry-powder");
  });

  it("hides a draft product from storefront callers", async () => {
    await createProduct({ sku: "SKU-2", slug: "wip-product", name: "WIP", status: "Draft" });

    expect(await getProductBySlug("wip-product")).toBeNull();
  });

  it("returns a draft product to admin callers", async () => {
    await createProduct({ sku: "SKU-3", slug: "wip-product-2", name: "WIP 2", status: "Draft" });

    const found = await getProductBySlugForAdmin("wip-product-2");

    expect(found?.slug).toBe("wip-product-2");
  });
});

describe("listProducts", () => {
  it("returns only Published products with a resolved Retail price", async () => {
    const published = await createProduct({
      sku: "LP-1",
      slug: "lp-1",
      name: "Published Product",
      status: "Published",
    });
    await createProduct({ sku: "LP-2", slug: "lp-2", name: "Draft Product", status: "Draft" });
    await createStandardPrice({ product: { connect: { id: published.id } }, price: "650.00" });

    const result = await listProducts({});

    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe("Published Product");
    expect(result.items[0].price).toBe(650);
  });

  it("excludes a product with no price configured", async () => {
    await createProduct({ sku: "LP-3", slug: "lp-3", name: "No Price", status: "Published" });

    const result = await listProducts({});

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("includes subcategory products when filtering by a parent category", async () => {
    const parent = await createCategory({ name: "Spices", slug: "svc-spices" });
    const child = await createCategory({
      name: "Curry Powders",
      slug: "svc-curry-powders",
      parent: { connect: { id: parent.id } },
    });
    const product = await createProduct({
      sku: "LP-4",
      slug: "lp-4",
      name: "In Subcategory",
      status: "Published",
      categories: { connect: [{ id: child.id }] },
    });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "500.00" });

    const result = await listProducts({ categorySlug: "svc-spices" });

    expect(result.items.map((i) => i.name)).toEqual(["In Subcategory"]);
  });

  it("returns an empty result for an unknown category slug", async () => {
    const result = await listProducts({ categorySlug: "does-not-exist" });

    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 24, hasNextPage: false });
  });

  it("returns an empty result for a collection outside its date window", async () => {
    await createCollection({
      name: "Old Promo",
      slug: "svc-old-promo",
      status: "Active",
      endDate: new Date("2020-01-01"),
    });

    const result = await listProducts({ collectionSlug: "svc-old-promo" });

    expect(result.items).toHaveLength(0);
  });

  it("filters by price range", async () => {
    const cheap = await createProduct({ sku: "LP-5", slug: "lp-5", name: "Cheap", status: "Published" });
    const expensive = await createProduct({
      sku: "LP-6",
      slug: "lp-6",
      name: "Expensive",
      status: "Published",
    });
    await createStandardPrice({ product: { connect: { id: cheap.id } }, price: "100.00" });
    await createStandardPrice({ product: { connect: { id: expensive.id } }, price: "900.00" });

    const result = await listProducts({ filters: { priceMin: 500 } });

    expect(result.items.map((i) => i.name)).toEqual(["Expensive"]);
  });

  it("sorts by price ascending and descending", async () => {
    const a = await createProduct({ sku: "LP-7", slug: "lp-7", name: "A", status: "Published" });
    const b = await createProduct({ sku: "LP-8", slug: "lp-8", name: "B", status: "Published" });
    await createStandardPrice({ product: { connect: { id: a.id } }, price: "300.00" });
    await createStandardPrice({ product: { connect: { id: b.id } }, price: "100.00" });

    const ascending = await listProducts({ sort: "price-asc" });
    const descending = await listProducts({ sort: "price-desc" });

    expect(ascending.items.map((i) => i.name)).toEqual(["B", "A"]);
    expect(descending.items.map((i) => i.name)).toEqual(["A", "B"]);
  });

  it("sorts newest by publishedAt descending, and falls back to newest for best-selling/rating", async () => {
    const older = await createProduct({
      sku: "LP-9",
      slug: "lp-9",
      name: "Older",
      status: "Published",
      publishedAt: new Date("2026-01-01"),
    });
    const newer = await createProduct({
      sku: "LP-10",
      slug: "lp-10",
      name: "Newer",
      status: "Published",
      publishedAt: new Date("2026-06-01"),
    });
    await createStandardPrice({ product: { connect: { id: older.id } }, price: "100.00" });
    await createStandardPrice({ product: { connect: { id: newer.id } }, price: "100.00" });

    const newest = await listProducts({ sort: "newest" });
    const bestSelling = await listProducts({ sort: "best-selling" });
    const rating = await listProducts({ sort: "rating" });

    expect(newest.items.map((i) => i.name)).toEqual(["Newer", "Older"]);
    expect(bestSelling.items.map((i) => i.name)).toEqual(["Newer", "Older"]);
    expect(rating.items.map((i) => i.name)).toEqual(["Newer", "Older"]);
  });

  it("paginates correctly at the first page, last page, and beyond the last page", async () => {
    for (let i = 0; i < 5; i++) {
      const product = await createProduct({
        sku: `LP-PAGE-${i}`,
        slug: `lp-page-${i}`,
        name: `Product ${i}`,
        status: "Published",
        publishedAt: new Date(2026, 0, i + 1),
      });
      await createStandardPrice({ product: { connect: { id: product.id } }, price: "100.00" });
    }

    const firstPage = await listProducts({ page: 1, pageSize: 2 });
    const lastPage = await listProducts({ page: 3, pageSize: 2 });
    const beyondLastPage = await listProducts({ page: 10, pageSize: 2 });

    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.total).toBe(5);
    expect(firstPage.hasNextPage).toBe(true);

    expect(lastPage.items).toHaveLength(1);
    expect(lastPage.hasNextPage).toBe(false);

    expect(beyondLastPage.items).toHaveLength(0);
    expect(beyondLastPage.hasNextPage).toBe(false);
  });
});
