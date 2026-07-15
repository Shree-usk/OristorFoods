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
import { resolvePrice } from "@/services/pricing.service";

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
