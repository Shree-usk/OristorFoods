// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import {
  createCampaignPrice,
  createCustomerGroupPrice,
  createSalePrice,
  createStandardPrice,
  createVolumeDiscountTier,
} from "@/repositories/pricing.repository";
import { resolvePrice, resolvePricesForProducts, getStandardPrice } from "@/services/pricing.service";

afterEach(async () => {
  await prisma.product.deleteMany();
});

describe("resolvePrice", () => {
  it("falls back to standard price when nothing else applies", async () => {
    const product = await createProduct({ sku: "SKU-1", slug: "sku-1", name: "A" });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "500.00" });

    const resolved = await resolvePrice({ productId: product.id });

    expect(resolved?.tier).toBe("standard");
    expect(resolved?.price.toFixed(2)).toBe("500.00");
  });

  it("returns null when no price tier exists at all", async () => {
    const product = await createProduct({ sku: "SKU-2", slug: "sku-2", name: "B" });

    expect(await resolvePrice({ productId: product.id })).toBeNull();
  });

  it("prefers an active campaign price over an active sale price", async () => {
    const product = await createProduct({ sku: "SKU-3", slug: "sku-3", name: "C" });
    const date = new Date("2026-07-15");
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "500.00" });
    await createSalePrice({
      product: { connect: { id: product.id } },
      price: "450.00",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-31"),
    });
    await createCampaignPrice({
      product: { connect: { id: product.id } },
      campaignId: "flash-sale",
      price: "400.00",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-31"),
    });

    const resolved = await resolvePrice({ productId: product.id, date });

    expect(resolved?.tier).toBe("campaign");
    expect(resolved?.price.toFixed(2)).toBe("400.00");
  });

  it("prefers an active sale price over a customer-group price", async () => {
    const product = await createProduct({ sku: "SKU-4", slug: "sku-4", name: "D" });
    const date = new Date("2026-07-15");
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "500.00" });
    await createCustomerGroupPrice({
      product: { connect: { id: product.id } },
      customerGroup: "Wholesale",
      price: "420.00",
    });
    await createSalePrice({
      product: { connect: { id: product.id } },
      price: "450.00",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-31"),
    });

    const resolved = await resolvePrice({
      productId: product.id,
      date,
      customerGroup: "Wholesale",
    });

    expect(resolved?.tier).toBe("sale");
    expect(resolved?.price.toFixed(2)).toBe("450.00");
  });

  it("gives a wholesale customer group price priority over a volume discount", async () => {
    const product = await createProduct({ sku: "SKU-5", slug: "sku-5", name: "E" });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "500.00" });
    await createCustomerGroupPrice({
      product: { connect: { id: product.id } },
      customerGroup: "Wholesale",
      price: "420.00",
    });
    await createVolumeDiscountTier({
      product: { connect: { id: product.id } },
      minQuantity: 10,
      discountPrice: "410.00",
    });

    const resolved = await resolvePrice({
      productId: product.id,
      customerGroup: "Wholesale",
      quantity: 20,
    });

    expect(resolved?.tier).toBe("customerGroup");
    expect(resolved?.price.toFixed(2)).toBe("420.00");
  });

  it("applies a qualifying volume discount when no higher tier matches", async () => {
    const product = await createProduct({ sku: "SKU-6", slug: "sku-6", name: "F" });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "500.00" });
    await createVolumeDiscountTier({
      product: { connect: { id: product.id } },
      minQuantity: 10,
      discountPrice: "410.00",
    });

    const resolved = await resolvePrice({ productId: product.id, quantity: 15 });

    expect(resolved?.tier).toBe("volumeDiscount");
    expect(resolved?.price.toFixed(2)).toBe("410.00");
  });

  it("computes a percentage volume discount off the standard price", async () => {
    const product = await createProduct({ sku: "SKU-7", slug: "sku-7", name: "G" });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "500.00" });
    await createVolumeDiscountTier({
      product: { connect: { id: product.id } },
      minQuantity: 10,
      discountPercent: "10.00",
    });

    const resolved = await resolvePrice({ productId: product.id, quantity: 10 });

    expect(resolved?.tier).toBe("volumeDiscount");
    expect(resolved?.price.toFixed(2)).toBe("450.00");
  });

  it("rounds a non-clean percentage volume discount half-up to 2 decimal places", async () => {
    const product = await createProduct({ sku: "SKU-9", slug: "sku-9", name: "I" });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "99.99" });
    await createVolumeDiscountTier({
      product: { connect: { id: product.id } },
      minQuantity: 10,
      discountPercent: "33.00",
    });

    const resolved = await resolvePrice({ productId: product.id, quantity: 10 });

    // 99.99 * (1 - 0.33) = 99.99 * 0.67 = 66.9933, which rounds half-up to 66.99
    expect(resolved?.tier).toBe("volumeDiscount");
    expect(resolved?.price.toFixed(2)).toBe("66.99");
  });

  it("does not apply a volume discount below its minimum quantity", async () => {
    const product = await createProduct({ sku: "SKU-8", slug: "sku-8", name: "H" });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "500.00" });
    await createVolumeDiscountTier({
      product: { connect: { id: product.id } },
      minQuantity: 10,
      discountPrice: "410.00",
    });

    const resolved = await resolvePrice({ productId: product.id, quantity: 5 });

    expect(resolved?.tier).toBe("standard");
    expect(resolved?.price.toFixed(2)).toBe("500.00");
  });
});

describe("resolvePricesForProducts", () => {
  it("resolves independent prices for multiple products in one call", async () => {
    const productA = await createProduct({ sku: "BULK-A", slug: "bulk-a", name: "A" });
    const productB = await createProduct({ sku: "BULK-B", slug: "bulk-b", name: "B" });
    await createStandardPrice({ product: { connect: { id: productA.id } }, price: "500.00" });
    await createStandardPrice({ product: { connect: { id: productB.id } }, price: "300.00" });
    await createSalePrice({
      product: { connect: { id: productB.id } },
      price: "250.00",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-31"),
    });

    const resolved = await resolvePricesForProducts([productA.id, productB.id], {
      date: new Date("2026-07-15"),
    });

    expect(resolved.get(productA.id)?.tier).toBe("standard");
    expect(resolved.get(productA.id)?.price.toFixed(2)).toBe("500.00");
    expect(resolved.get(productB.id)?.tier).toBe("sale");
    expect(resolved.get(productB.id)?.price.toFixed(2)).toBe("250.00");
  });

  it("omits a product from the result map when it has no price configured", async () => {
    const product = await createProduct({ sku: "BULK-C", slug: "bulk-c", name: "C" });

    const resolved = await resolvePricesForProducts([product.id]);

    expect(resolved.has(product.id)).toBe(false);
  });

  it("returns an empty map for an empty product list", async () => {
    expect((await resolvePricesForProducts([])).size).toBe(0);
  });

  it("applies a customer-group price only to products where it was configured", async () => {
    const wholesaleProduct = await createProduct({ sku: "BULK-D", slug: "bulk-d", name: "D" });
    const retailOnlyProduct = await createProduct({ sku: "BULK-E", slug: "bulk-e", name: "E" });
    await createStandardPrice({ product: { connect: { id: wholesaleProduct.id } }, price: "500.00" });
    await createStandardPrice({ product: { connect: { id: retailOnlyProduct.id } }, price: "300.00" });
    await createCustomerGroupPrice({
      product: { connect: { id: wholesaleProduct.id } },
      customerGroup: "Wholesale",
      price: "420.00",
    });

    const resolved = await resolvePricesForProducts([wholesaleProduct.id, retailOnlyProduct.id], {
      customerGroup: "Wholesale",
    });

    expect(resolved.get(wholesaleProduct.id)?.tier).toBe("customerGroup");
    expect(resolved.get(retailOnlyProduct.id)?.tier).toBe("standard");
  });
});

describe("getStandardPrice", () => {
  it("returns the latest standard price as a plain number", async () => {
    const product = await createProduct({ sku: "STD-1", slug: "std-1", name: "Std", status: "Published" });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "300.00" });

    const result = await getStandardPrice(product.id);

    expect(result).toEqual({ price: 300, currency: "LKR" });
  });

  it("returns null when no standard price is configured", async () => {
    const product = await createProduct({ sku: "STD-2", slug: "std-2", name: "Std 2", status: "Published" });

    expect(await getStandardPrice(product.id)).toBeNull();
  });
});
