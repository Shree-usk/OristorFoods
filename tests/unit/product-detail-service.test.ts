// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createCategory } from "@/repositories/category.repository";
import { createBrand } from "@/repositories/brand.repository";
import {
  addProductIngredient,
  createBundle,
  createProduct,
  setProductNutrition,
} from "@/repositories/product.repository";
import { addBundleItem } from "@/repositories/product.repository";
import { createSalePrice, createStandardPrice } from "@/repositories/pricing.repository";
import { getProductDetail, getProductsForCompare, listRelatedProducts } from "@/services/product.service";
import {
  registerReviewSummaryProvider,
  resetProductDetailExtensionsForTesting,
} from "@/services/product-detail-extensions";

afterEach(async () => {
  resetProductDetailExtensionsForTesting();
  await prisma.bundleItem.deleteMany();
  await prisma.productBundle.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
});

describe("getProductDetail", () => {
  it("returns null for an unpublished or missing product", async () => {
    await createProduct({ sku: "PD-1", slug: "pd-draft", name: "Draft", status: "Draft" });

    expect(await getProductDetail("pd-draft")).toBeNull();
    expect(await getProductDetail("does-not-exist")).toBeNull();
  });

  it("returns null when no price is configured", async () => {
    await createProduct({ sku: "PD-2", slug: "pd-no-price", name: "No Price", status: "Published" });

    expect(await getProductDetail("pd-no-price")).toBeNull();
  });

  it("aggregates catalogue, nutrition, ingredients, and price for a published product", async () => {
    const product = await createProduct({
      sku: "PD-3",
      slug: "pd-full",
      name: "Full Product",
      shortDescription: "Short",
      story: "Long story",
      status: "Published",
      rewardPoints: 12,
      benefits: ["Benefit A"],
      servingSuggestions: ["Suggestion A"],
    });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "500.00" });
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
    await addProductIngredient({ product: { connect: { id: product.id } }, name: "Salt", sortOrder: 1 });

    const detail = await getProductDetail("pd-full");

    expect(detail?.name).toBe("Full Product");
    expect(detail?.price).toBe(500);
    expect(detail?.originalPrice).toBeNull();
    expect(detail?.rewardPoints).toBe(12);
    expect(detail?.benefits).toEqual(["Benefit A"]);
    expect(detail?.servingSuggestions).toEqual(["Suggestion A"]);
    expect(detail?.nutrition?.servingSize).toBe("1 tsp");
    expect(detail?.ingredients).toEqual([{ name: "Salt", isAllergen: false }]);
  });

  it("exposes the standard price as originalPrice when a discount tier applies", async () => {
    const product = await createProduct({ sku: "PD-4", slug: "pd-sale", name: "On Sale", status: "Published" });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "1000.00" });
    await createSalePrice({
      product: { connect: { id: product.id } },
      price: "800.00",
      startDate: new Date(Date.now() - 1000 * 60 * 60),
      endDate: new Date(Date.now() + 1000 * 60 * 60),
    });

    const detail = await getProductDetail("pd-sale");

    expect(detail?.price).toBe(800);
    expect(detail?.originalPrice).toBe(1000);
  });

  it("defaults review/QA/recipe summaries to null before any provider registers", async () => {
    const product = await createProduct({ sku: "PD-5", slug: "pd-extensions", name: "Ext", status: "Published" });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "100.00" });

    const detail = await getProductDetail("pd-extensions");

    expect(detail?.reviewSummary).toBeNull();
    expect(detail?.qaSummary).toBeNull();
    expect(detail?.recipeSummary).toBeNull();
  });

  it("uses a registered review summary provider once one exists", async () => {
    const product = await createProduct({ sku: "PD-6", slug: "pd-reviews", name: "Reviewed", status: "Published" });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "100.00" });
    registerReviewSummaryProvider(async () => ({
      averageRating: 4.5,
      reviewCount: 3,
      histogram: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 2 },
      previewReviews: [],
    }));

    const detail = await getProductDetail("pd-reviews");

    expect(detail?.reviewSummary?.averageRating).toBe(4.5);
  });

  it("renders bundle component items for a Bundle product type", async () => {
    const component = await createProduct({
      sku: "PD-COMP",
      slug: "pd-component",
      name: "Component",
      status: "Published",
    });
    await createStandardPrice({ product: { connect: { id: component.id } }, price: "50.00" });
    const bundleProduct = await createProduct({
      sku: "PD-BUNDLE",
      slug: "pd-bundle",
      name: "Bundle",
      productType: "Bundle",
      status: "Published",
    });
    await createStandardPrice({ product: { connect: { id: bundleProduct.id } }, price: "90.00" });
    const bundle = await createBundle({ product: { connect: { id: bundleProduct.id } } });
    await addBundleItem({
      bundle: { connect: { id: bundle.id } },
      componentProduct: { connect: { id: component.id } },
      quantity: 2,
    });

    const detail = await getProductDetail("pd-bundle");

    expect(detail?.bundleItems).toEqual([
      { productId: component.id, name: "Component", slug: "pd-component", quantity: 2, imageSrc: "", imageAlt: "Component" },
    ]);
  });
});

describe("listRelatedProducts", () => {
  it("returns published products sharing a category, excluding the given product", async () => {
    const category = await createCategory({ name: "Spices", slug: "related-spices" });
    const self = await createProduct({
      sku: "REL-1",
      slug: "rel-1",
      name: "Self",
      status: "Published",
      categories: { connect: [{ id: category.id }] },
    });
    const sibling = await createProduct({
      sku: "REL-2",
      slug: "rel-2",
      name: "Sibling",
      status: "Published",
      categories: { connect: [{ id: category.id }] },
    });
    await createStandardPrice({ product: { connect: { id: self.id } }, price: "100.00" });
    await createStandardPrice({ product: { connect: { id: sibling.id } }, price: "100.00" });

    const related = await listRelatedProducts({ productId: self.id, categoryIds: [category.id] });

    expect(related.map((p) => p.id)).toEqual([sibling.id]);
  });

  it("returns an empty array when the product has no categories", async () => {
    const related = await listRelatedProducts({ productId: "no-categories", categoryIds: [] });

    expect(related).toEqual([]);
  });
});

describe("getProductsForCompare", () => {
  it("returns comparison data for published products with a resolved price", async () => {
    const brand = await createBrand({ name: "Oristor GPFC", slug: "oristor-gpfc" });
    const product = await createProduct({
      sku: "GPFC-1",
      slug: "gpfc-1",
      name: "Curry Powder",
      status: "Published",
      brand: { connect: { id: brand.id } },
    });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "450.00" });
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

    const items = await getProductsForCompare([product.id]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: product.id,
      name: "Curry Powder",
      brandName: "Oristor GPFC",
      price: 450,
      nutrition: { servingSize: "1 tsp" },
      rating: null,
      reviewCount: null,
    });
  });

  it("excludes a product with no resolved price", async () => {
    const product = await createProduct({ sku: "GPFC-2", slug: "gpfc-2", name: "No Price", status: "Published" });

    expect(await getProductsForCompare([product.id])).toEqual([]);
  });

  it("excludes a non-Published product", async () => {
    const product = await createProduct({ sku: "GPFC-3", slug: "gpfc-3", name: "Draft", status: "Draft" });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "100.00" });

    expect(await getProductsForCompare([product.id])).toEqual([]);
  });

  it("returns results in the order of the input ids, not database order", async () => {
    const a = await createProduct({ sku: "GPFC-4", slug: "gpfc-4", name: "A", status: "Published" });
    await createStandardPrice({ product: { connect: { id: a.id } }, price: "100.00" });
    const b = await createProduct({ sku: "GPFC-5", slug: "gpfc-5", name: "B", status: "Published" });
    await createStandardPrice({ product: { connect: { id: b.id } }, price: "200.00" });

    const items = await getProductsForCompare([b.id, a.id]);

    expect(items.map((item) => item.id)).toEqual([b.id, a.id]);
  });

  it("uses a registered review summary provider once one exists", async () => {
    registerReviewSummaryProvider(async () => ({
      averageRating: 4.5,
      reviewCount: 3,
      histogram: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 2 },
      previewReviews: [],
    }));
    const product = await createProduct({ sku: "GPFC-6", slug: "gpfc-6", name: "Rated", status: "Published" });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "100.00" });

    const items = await getProductsForCompare([product.id]);

    expect(items[0]).toMatchObject({ rating: 4.5, reviewCount: 3 });
  });

  it("returns an empty array for an empty input", async () => {
    expect(await getProductsForCompare([])).toEqual([]);
  });
});
