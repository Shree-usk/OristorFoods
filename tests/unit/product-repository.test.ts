// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createBrand } from "@/repositories/brand.repository";
import { createCategory } from "@/repositories/category.repository";
import {
  addProductImage,
  addProductIngredient,
  createAllergen,
  createCertification,
  createProduct,
  findProductById,
  findProductBySku,
  findProductBySlug,
  findProductDetailBySlug,
  findPublishedProductsForListing,
  listAllergens,
  listCertifications,
  listProductsByCategory,
  listProductsByStatus,
  setProductNutrition,
} from "@/repositories/product.repository";

afterEach(async () => {
  await prisma.product.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.category.deleteMany();
  await prisma.allergen.deleteMany();
  await prisma.certification.deleteMany();
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

describe("findPublishedProductsForListing", () => {
  it("only returns Published products, never other statuses", async () => {
    await createProduct({ sku: "LIST-1", slug: "list-1", name: "Live", status: "Published" });
    await createProduct({ sku: "LIST-2", slug: "list-2", name: "Draft", status: "Draft" });

    const results = await findPublishedProductsForListing({});

    expect(results.map((p) => p.slug)).toEqual(["list-1"]);
  });

  it("filters by category id", async () => {
    const category = await createCategory({ name: "Spice Blends", slug: "spice-blends-list" });
    const other = await createCategory({ name: "Snacks", slug: "snacks-list" });
    await createProduct({
      sku: "LIST-3",
      slug: "list-3",
      name: "In Category",
      status: "Published",
      categories: { connect: [{ id: category.id }] },
    });
    await createProduct({
      sku: "LIST-4",
      slug: "list-4",
      name: "Other Category",
      status: "Published",
      categories: { connect: [{ id: other.id }] },
    });

    const results = await findPublishedProductsForListing({ categoryIds: [category.id] });

    expect(results.map((p) => p.slug)).toEqual(["list-3"]);
  });

  it("excludes products containing a selected allergen to avoid", async () => {
    const peanuts = await createAllergen({ name: "Peanuts" });
    await createProduct({
      sku: "LIST-5",
      slug: "list-5",
      name: "Contains Peanuts",
      status: "Published",
      allergens: { connect: [{ id: peanuts.id }] },
    });
    await createProduct({ sku: "LIST-6", slug: "list-6", name: "Peanut Free", status: "Published" });

    const results = await findPublishedProductsForListing({ allergenNamesToExclude: ["Peanuts"] });

    expect(results.map((p) => p.slug)).toEqual(["list-6"]);
  });

  it("includes only products with a selected certification", async () => {
    const organic = await createCertification({ name: "Organic" });
    await createProduct({
      sku: "LIST-7",
      slug: "list-7",
      name: "Organic Product",
      status: "Published",
      certifications: { connect: [{ id: organic.id }] },
    });
    await createProduct({ sku: "LIST-8", slug: "list-8", name: "Non-Organic", status: "Published" });

    const results = await findPublishedProductsForListing({ certificationIds: [organic.id] });

    expect(results.map((p) => p.slug)).toEqual(["list-7"]);
  });

  it("filters by brand slug", async () => {
    const brand = await createBrand({ name: "Oristor", slug: "oristor-list" });
    await createProduct({
      sku: "LIST-9",
      slug: "list-9",
      name: "Branded",
      status: "Published",
      brand: { connect: { id: brand.id } },
    });
    await createProduct({ sku: "LIST-10", slug: "list-10", name: "Unbranded", status: "Published" });

    const results = await findPublishedProductsForListing({ brandSlugs: ["oristor-list"] });

    expect(results.map((p) => p.slug)).toEqual(["list-9"]);
  });

  it("filters by inStock", async () => {
    await createProduct({
      sku: "LIST-11",
      slug: "list-11",
      name: "In Stock",
      status: "Published",
      inStock: true,
    });
    await createProduct({
      sku: "LIST-12",
      slug: "list-12",
      name: "Out of Stock",
      status: "Published",
      inStock: false,
    });

    const results = await findPublishedProductsForListing({ inStock: true });

    expect(results.map((p) => p.slug)).toEqual(["list-11"]);
  });

  it("excludes the given product id", async () => {
    const excluded = await createProduct({
      sku: "LIST-13",
      slug: "list-13",
      name: "Excluded",
      status: "Published",
    });
    await createProduct({ sku: "LIST-14", slug: "list-14", name: "Included", status: "Published" });

    const results = await findPublishedProductsForListing({ excludeProductId: excluded.id });

    expect(results.map((p) => p.slug)).not.toContain("list-13");
    expect(results.map((p) => p.slug)).toContain("list-14");
  });

  it("bounds the result count when take is given", async () => {
    await createProduct({ sku: "LIST-15", slug: "list-15", name: "A", status: "Published" });
    await createProduct({ sku: "LIST-16", slug: "list-16", name: "B", status: "Published" });
    await createProduct({ sku: "LIST-17", slug: "list-17", name: "C", status: "Published" });

    const results = await findPublishedProductsForListing({ take: 2 });

    expect(results).toHaveLength(2);
  });
});

describe("findProductDetailBySlug", () => {
  it("returns null for an unknown slug", async () => {
    expect(await findProductDetailBySlug("does-not-exist")).toBeNull();
  });

  it("includes nutrition, ordered ingredients, allergens, certifications, and images", async () => {
    const product = await createProduct({
      sku: "DETAIL-REPO-1",
      slug: "detail-repo-1",
      name: "Detail Repo Product",
      status: "Published",
      benefits: ["Rich in fibre"],
      servingSuggestions: ["Add to soups"],
    });
    await setProductNutrition({
      product: { connect: { id: product.id } },
      servingSize: "1 tsp",
      calories: "10.00",
      protein: "1.00",
      fat: "0.50",
      saturatedFat: "0.10",
      carbohydrates: "1.00",
      sugar: "0.20",
      fibre: "0.50",
      sodium: "1.00",
    });
    await addProductIngredient({ product: { connect: { id: product.id } }, name: "Second", sortOrder: 2 });
    await addProductIngredient({ product: { connect: { id: product.id } }, name: "First", sortOrder: 1 });
    await addProductImage({ product: { connect: { id: product.id } }, url: "/a.jpg", isPrimary: false, sortOrder: 2 });
    await addProductImage({ product: { connect: { id: product.id } }, url: "/b.jpg", isPrimary: true, sortOrder: 1 });

    const found = await findProductDetailBySlug("detail-repo-1");

    expect(found?.benefits).toEqual(["Rich in fibre"]);
    expect(found?.servingSuggestions).toEqual(["Add to soups"]);
    expect(found?.nutrition?.servingSize).toBe("1 tsp");
    expect(found?.ingredients.map((i) => i.name)).toEqual(["First", "Second"]);
    expect(found?.images.map((i) => i.url)).toEqual(["/b.jpg", "/a.jpg"]);
  });
});

describe("listAllergens and listCertifications", () => {
  it("lists all allergens alphabetically", async () => {
    await createAllergen({ name: "Peanuts" });
    await createAllergen({ name: "Gluten" });

    const results = await listAllergens();

    expect(results.map((a) => a.name)).toEqual(["Gluten", "Peanuts"]);
  });

  it("lists all certifications alphabetically", async () => {
    await createCertification({ name: "SLS" });
    await createCertification({ name: "Organic" });

    const results = await listCertifications();

    expect(results.map((c) => c.name)).toEqual(["Organic", "SLS"]);
  });
});
