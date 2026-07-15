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
  getActiveCampaignPrices,
  getActiveSalePrices,
  getApplicableVolumeDiscountTiers,
  getCustomerGroupPrice,
  getLatestStandardPrice,
} from "@/repositories/pricing.repository";

afterEach(async () => {
  await prisma.product.deleteMany();
});

describe("pricing.repository", () => {
  it("returns the most recently created standard price", async () => {
    const product = await createProduct({ sku: "SKU-1", slug: "sku-1", name: "A" });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "500.00" });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "550.00" });

    const latest = await getLatestStandardPrice(product.id);

    expect(latest?.price.toFixed(2)).toBe("550.00");
  });

  it("only returns sale and campaign prices active on the given date", async () => {
    const product = await createProduct({ sku: "SKU-2", slug: "sku-2", name: "B" });
    await createSalePrice({
      product: { connect: { id: product.id } },
      price: "450.00",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-10"),
    });
    await createCampaignPrice({
      product: { connect: { id: product.id } },
      campaignId: "avurudu-2026",
      price: "400.00",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2026-04-30"),
    });

    expect(await getActiveSalePrices(product.id, new Date("2026-07-05"))).toHaveLength(1);
    expect(await getActiveSalePrices(product.id, new Date("2026-07-15"))).toHaveLength(0);
    expect(await getActiveCampaignPrices(product.id, new Date("2026-04-15"))).toHaveLength(1);
    expect(await getActiveCampaignPrices(product.id, new Date("2026-07-15"))).toHaveLength(0);
  });

  it("looks up the price for a specific customer group", async () => {
    const product = await createProduct({ sku: "SKU-3", slug: "sku-3", name: "C" });
    await createCustomerGroupPrice({
      product: { connect: { id: product.id } },
      customerGroup: "Wholesale",
      price: "420.00",
    });

    const wholesale = await getCustomerGroupPrice(product.id, "Wholesale");
    const distributor = await getCustomerGroupPrice(product.id, "Distributor");

    expect(wholesale?.price.toFixed(2)).toBe("420.00");
    expect(distributor).toBeNull();
  });

  it("returns volume discount tiers applicable to a quantity, deepest first", async () => {
    const product = await createProduct({ sku: "SKU-4", slug: "sku-4", name: "D" });
    await createVolumeDiscountTier({
      product: { connect: { id: product.id } },
      minQuantity: 10,
      discountPercent: "5.00",
    });
    await createVolumeDiscountTier({
      product: { connect: { id: product.id } },
      minQuantity: 50,
      discountPercent: "10.00",
    });

    const tiers = await getApplicableVolumeDiscountTiers(product.id, 60);
    const tiersBelowSecondTier = await getApplicableVolumeDiscountTiers(product.id, 20);

    expect(tiers.map((t) => t.minQuantity)).toEqual([50, 10]);
    expect(tiersBelowSecondTier.map((t) => t.minQuantity)).toEqual([10]);
  });
});
