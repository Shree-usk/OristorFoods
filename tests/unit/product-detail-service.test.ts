// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createCategory } from "@/repositories/category.repository";
import { createBrand } from "@/repositories/brand.repository";
import { createBundleItem, createBundle } from "@/repositories/bundle.repository";
import {
  addProductIngredient,
  createProduct,
  setProductNutrition,
} from "@/repositories/product.repository";
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
  await prisma.giftOfferRedemption.deleteMany();
  await prisma.giftOffer.deleteMany();
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

  it("does not 404 a variant-driven product even with no StandardPrice on the parent, and resolves price from the default variant", async () => {
    const product = await createProduct({ sku: "PD-VARIANTS", slug: "pd-variants", name: "Variant Product", status: "Published" });
    await prisma.productVariant.create({
      data: { productId: product.id, sku: "PD-VARIANTS-100G", name: "100g", netWeightGrams: 100, price: "500.00", currency: "LKR", stockQuantity: 0, inStock: false, isActive: true },
    });
    await prisma.productVariant.create({
      data: { productId: product.id, sku: "PD-VARIANTS-350G", name: "350g", netWeightGrams: 350, price: "900.00", promoPrice: "750.00", currency: "LKR", stockQuantity: 5, inStock: true, isActive: true },
    });

    const detail = await getProductDetail("pd-variants");
    expect(detail).not.toBeNull();
    expect(detail?.variants).toHaveLength(2);
    // Defaults to the first in-stock variant, not just the first row.
    expect(detail?.price).toBe(750);
    expect(detail?.originalPrice).toBe(900);

    await prisma.productVariant.deleteMany({ where: { productId: product.id } });
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
    const inspirationCard = await prisma.productInspirationCard.create({
      data: { product: { connect: { id: product.id } }, imageUrl: "/inspiration.webp", title: "Weeknight dinner", description: "Quick and easy.", sortOrder: 0 },
    });
    const featuredItem = await prisma.productFeaturedItem.create({
      data: { product: { connect: { id: product.id } }, imageUrl: "/featured.webp", title: "Sweet Basil", description: "Fresh and fragrant.", sortOrder: 0 },
    });

    const detail = await getProductDetail("pd-full");

    expect(detail?.name).toBe("Full Product");
    expect(detail?.price).toBe(500);
    expect(detail?.originalPrice).toBeNull();
    expect(detail?.rewardPoints).toBe(12);
    expect(detail?.benefits).toEqual(["Benefit A"]);
    expect(detail?.servingSuggestions).toEqual(["Suggestion A"]);
    expect(detail?.nutrition?.servingSize).toBe("1 tsp");
    expect(detail?.ingredients).toEqual([{ name: "Salt", isAllergen: false }]);
    expect(detail?.inspirationCards).toEqual([
      { id: inspirationCard.id, imageUrl: "/inspiration.webp", imageAlt: null, title: "Weeknight dinner", description: "Quick and easy." },
    ]);
    expect(detail?.featuredItems).toEqual([
      { id: featuredItem.id, imageUrl: "/featured.webp", imageAlt: null, title: "Sweet Basil", description: "Fresh and fragrant." },
    ]);
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
    // Deliberately no StandardPrice on the bundle product itself — a real
    // bundle's price comes entirely from the bundle definition below, same
    // as a variant-driven product never needs one. Reproduces a real bug
    // caught live on staging: getProductDetail's "has no configured price"
    // gate didn't know about bundles and 404'd a correctly-configured one.
    const bundle = await createBundle({ product: { connect: { id: bundleProduct.id } }, bundleType: "Fixed", name: "Bundle" });
    await createBundleItem({
      bundle: { connect: { id: bundle.id } },
      componentProduct: { connect: { id: component.id } },
      quantity: 2,
    });

    const detail = await getProductDetail("pd-bundle");

    expect(detail?.bundleItems).toEqual([
      {
        bundleItemId: expect.any(String),
        productId: component.id,
        variantId: null,
        name: "Component",
        slug: "pd-component",
        quantity: 2,
        imageSrc: "",
        imageAlt: "Component",
        price: 50,
        inStock: true,
        isRequired: true,
        minQuantity: 0,
        maxQuantity: null,
      },
    ]);
    expect(detail?.bundle).toMatchObject({ bundleType: "Fixed", name: "Bundle", standaloneTotal: 100, discountedTotal: 100 });
    // The page-level price/currency must also come from the bundle, not
    // 404 or fall through to an unresolved base-product price.
    expect(detail?.price).toBe(100);
    expect(detail?.currency).toBe("LKR");
  });

  it("omits an Inactive bundle from the PDP, instead of displaying it as a live, purchasable offer", async () => {
    const component = await createProduct({ sku: "PD-COMP-INACTIVE", slug: "pd-component-inactive", name: "Component", status: "Published" });
    await createStandardPrice({ product: { connect: { id: component.id } }, price: "50.00" });
    const hostProduct = await createProduct({ sku: "PD-HOST-INACTIVE", slug: "pd-host-inactive-bundle", name: "Host", status: "Published" });
    await createStandardPrice({ product: { connect: { id: hostProduct.id } }, price: "300.00" });
    const bundle = await createBundle({ product: { connect: { id: hostProduct.id } }, bundleType: "Fixed", name: "Draft Bundle", status: "Inactive" });
    await createBundleItem({ bundle: { connect: { id: bundle.id } }, componentProduct: { connect: { id: component.id } }, quantity: 1 });

    const detail = await getProductDetail("pd-host-inactive-bundle");

    expect(detail?.bundle).toBeNull();
    expect(detail?.bundleItems).toEqual([]);
    // Falls back to the host product's own StandardPrice, not the
    // ineligible bundle's total and not a silent LKR 0.
    expect(detail?.price).toBe(300);
  });

  it("omits a bundle scheduled to start in the future", async () => {
    const component = await createProduct({ sku: "PD-COMP-FUTURE", slug: "pd-component-future", name: "Component", status: "Published" });
    await createStandardPrice({ product: { connect: { id: component.id } }, price: "50.00" });
    const hostProduct = await createProduct({ sku: "PD-HOST-FUTURE", slug: "pd-host-future-bundle", name: "Host", status: "Published" });
    await createStandardPrice({ product: { connect: { id: hostProduct.id } }, price: "300.00" });
    const bundle = await createBundle({
      product: { connect: { id: hostProduct.id } },
      bundleType: "Fixed",
      name: "Upcoming Bundle",
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    await createBundleItem({ bundle: { connect: { id: bundle.id } }, componentProduct: { connect: { id: component.id } }, quantity: 1 });

    const detail = await getProductDetail("pd-host-future-bundle");

    expect(detail?.bundle).toBeNull();
    expect(detail?.price).toBe(300);
  });

  it("omits a bundle whose end date has already passed", async () => {
    const component = await createProduct({ sku: "PD-COMP-EXPIRED", slug: "pd-component-expired", name: "Component", status: "Published" });
    await createStandardPrice({ product: { connect: { id: component.id } }, price: "50.00" });
    const hostProduct = await createProduct({ sku: "PD-HOST-EXPIRED", slug: "pd-host-expired-bundle", name: "Host", status: "Published" });
    await createStandardPrice({ product: { connect: { id: hostProduct.id } }, price: "300.00" });
    const bundle = await createBundle({
      product: { connect: { id: hostProduct.id } },
      bundleType: "Fixed",
      name: "Past Bundle",
      endDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
    await createBundleItem({ bundle: { connect: { id: bundle.id } }, componentProduct: { connect: { id: component.id } }, quantity: 1 });

    const detail = await getProductDetail("pd-host-expired-bundle");

    expect(detail?.bundle).toBeNull();
    expect(detail?.price).toBe(300);
  });

  it("includes an Active bundle that is inside its scheduled start/end window", async () => {
    const component = await createProduct({ sku: "PD-COMP-WINDOW", slug: "pd-component-window", name: "Component", status: "Published" });
    await createStandardPrice({ product: { connect: { id: component.id } }, price: "50.00" });
    const hostProduct = await createProduct({ sku: "PD-HOST-WINDOW", slug: "pd-host-window-bundle", name: "Host", status: "Published" });
    await createStandardPrice({ product: { connect: { id: hostProduct.id } }, price: "300.00" });
    const bundle = await createBundle({
      product: { connect: { id: hostProduct.id } },
      bundleType: "Fixed",
      name: "Live Bundle",
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    await createBundleItem({ bundle: { connect: { id: bundle.id } }, componentProduct: { connect: { id: component.id } }, quantity: 1 });

    const detail = await getProductDetail("pd-host-window-bundle");

    expect(detail?.bundle).not.toBeNull();
    expect(detail?.bundle?.name).toBe("Live Bundle");
  });

  it("omits an Inactive gift offer from the PDP (Story 5)", async () => {
    const giftProduct = await createProduct({ sku: "PD-GIFT-INACTIVE", slug: "pd-gift-inactive-gift", name: "Gift", status: "Published" });
    await createStandardPrice({ product: { connect: { id: giftProduct.id } }, price: "50.00" });
    const hostProduct = await createProduct({ sku: "PD-HOST-GIFT-INACTIVE", slug: "pd-host-inactive-gift", name: "Host", status: "Published" });
    await createStandardPrice({ product: { connect: { id: hostProduct.id } }, price: "300.00" });
    await prisma.giftOffer.create({
      data: { product: { connect: { id: hostProduct.id } }, name: "Inactive Gift", status: "Inactive", giftProduct: { connect: { id: giftProduct.id } } },
    });

    const detail = await getProductDetail("pd-host-inactive-gift");

    expect(detail?.giftOffer).toBeNull();
  });

  it("omits a gift offer scheduled to start in the future", async () => {
    const giftProduct = await createProduct({ sku: "PD-GIFT-FUTURE", slug: "pd-gift-future-gift", name: "Gift", status: "Published" });
    await createStandardPrice({ product: { connect: { id: giftProduct.id } }, price: "50.00" });
    const hostProduct = await createProduct({ sku: "PD-HOST-GIFT-FUTURE", slug: "pd-host-future-gift", name: "Host", status: "Published" });
    await createStandardPrice({ product: { connect: { id: hostProduct.id } }, price: "300.00" });
    await prisma.giftOffer.create({
      data: {
        product: { connect: { id: hostProduct.id } },
        name: "Future Gift",
        startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        giftProduct: { connect: { id: giftProduct.id } },
      },
    });

    const detail = await getProductDetail("pd-host-future-gift");

    expect(detail?.giftOffer).toBeNull();
  });

  it("omits a gift offer whose end date has already passed", async () => {
    const giftProduct = await createProduct({ sku: "PD-GIFT-EXPIRED", slug: "pd-gift-expired-gift", name: "Gift", status: "Published" });
    await createStandardPrice({ product: { connect: { id: giftProduct.id } }, price: "50.00" });
    const hostProduct = await createProduct({ sku: "PD-HOST-GIFT-EXPIRED", slug: "pd-host-expired-gift", name: "Host", status: "Published" });
    await createStandardPrice({ product: { connect: { id: hostProduct.id } }, price: "300.00" });
    await prisma.giftOffer.create({
      data: {
        product: { connect: { id: hostProduct.id } },
        name: "Expired Gift",
        endDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        giftProduct: { connect: { id: giftProduct.id } },
      },
    });

    const detail = await getProductDetail("pd-host-expired-gift");

    expect(detail?.giftOffer).toBeNull();
  });

  it("includes an Active gift offer that is inside its scheduled start/end window", async () => {
    const giftProduct = await createProduct({ sku: "PD-GIFT-WINDOW", slug: "pd-gift-window-gift", name: "Gift", status: "Published" });
    await createStandardPrice({ product: { connect: { id: giftProduct.id } }, price: "50.00" });
    const hostProduct = await createProduct({ sku: "PD-HOST-GIFT-WINDOW", slug: "pd-host-window-gift", name: "Host", status: "Published" });
    await createStandardPrice({ product: { connect: { id: hostProduct.id } }, price: "300.00" });
    await prisma.giftOffer.create({
      data: {
        product: { connect: { id: hostProduct.id } },
        name: "Live Gift",
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        giftProduct: { connect: { id: giftProduct.id } },
      },
    });

    const detail = await getProductDetail("pd-host-window-gift");

    expect(detail?.giftOffer).not.toBeNull();
    expect(detail?.giftOffer).toMatchObject({ name: "Live Gift", standaloneValue: 50, giftQuantity: 1, inStock: true });
  });

  it("falls back to the gift variant's real price for 'worth' display when promoPrice is explicitly 0, instead of showing 0", async () => {
    const giftProduct = await createProduct({ sku: "PD-GIFT-VARIANT-ZERO-PROMO", slug: "pd-gift-variant-zero-promo-gift", name: "Gift", status: "Published" });
    const giftVariant = await prisma.productVariant.create({
      data: { productId: giftProduct.id, sku: "PD-GIFT-VARIANT-ZERO-PROMO-V1", name: "500g", netWeightGrams: 500, price: "320.00", promoPrice: "0.00", currency: "LKR", stockQuantity: 10, isActive: true, inStock: true },
    });
    const hostProduct = await createProduct({ sku: "PD-HOST-GIFT-VARIANT-ZERO-PROMO", slug: "pd-host-variant-zero-promo-gift", name: "Host", status: "Published" });
    await createStandardPrice({ product: { connect: { id: hostProduct.id } }, price: "300.00" });
    await prisma.giftOffer.create({
      data: {
        product: { connect: { id: hostProduct.id } },
        name: "Zero Promo Variant Gift",
        giftProduct: { connect: { id: giftProduct.id } },
        giftVariant: { connect: { id: giftVariant.id } },
      },
    });

    const detail = await getProductDetail("pd-host-variant-zero-promo-gift");

    expect(detail?.giftOffer).toMatchObject({ standaloneValue: 320 });
  });

  it("uses the gift variant's real non-zero promoPrice for 'worth' display when one is genuinely set (regression)", async () => {
    const giftProduct = await createProduct({ sku: "PD-GIFT-VARIANT-REAL-PROMO", slug: "pd-gift-variant-real-promo-gift", name: "Gift", status: "Published" });
    const giftVariant = await prisma.productVariant.create({
      data: { productId: giftProduct.id, sku: "PD-GIFT-VARIANT-REAL-PROMO-V1", name: "500g", netWeightGrams: 500, price: "320.00", promoPrice: "280.00", currency: "LKR", stockQuantity: 10, isActive: true, inStock: true },
    });
    const hostProduct = await createProduct({ sku: "PD-HOST-GIFT-VARIANT-REAL-PROMO", slug: "pd-host-variant-real-promo-gift", name: "Host", status: "Published" });
    await createStandardPrice({ product: { connect: { id: hostProduct.id } }, price: "300.00" });
    await prisma.giftOffer.create({
      data: {
        product: { connect: { id: hostProduct.id } },
        name: "Real Promo Variant Gift",
        giftProduct: { connect: { id: giftProduct.id } },
        giftVariant: { connect: { id: giftVariant.id } },
      },
    });

    const detail = await getProductDetail("pd-host-variant-real-promo-gift");

    expect(detail?.giftOffer).toMatchObject({ standaloneValue: 280 });
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

  it("includes a sibling that's variant-driven with no StandardPrice — regression for a real bug found live on staging", async () => {
    const category = await createCategory({ name: "Spices", slug: "related-spices-variant" });
    const self = await createProduct({
      sku: "REL-3",
      slug: "rel-3",
      name: "Self",
      status: "Published",
      categories: { connect: [{ id: category.id }] },
    });
    const variantSibling = await createProduct({
      sku: "REL-4",
      slug: "rel-4",
      name: "Variant Sibling",
      status: "Published",
      categories: { connect: [{ id: category.id }] },
    });
    await createStandardPrice({ product: { connect: { id: self.id } }, price: "100.00" });
    await prisma.productVariant.create({
      data: { productId: variantSibling.id, sku: "REL-4-100G", name: "100g", netWeightGrams: 100, price: "400.00", currency: "LKR", stockQuantity: 5, inStock: true, isActive: true },
    });

    const related = await listRelatedProducts({ productId: self.id, categoryIds: [category.id] });

    expect(related.map((p) => p.id)).toEqual([variantSibling.id]);
    expect(related[0]).toMatchObject({ price: 400, currency: "LKR" });
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
