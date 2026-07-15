// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  addBundleItem,
  createBundle,
  createProduct,
  getBundleWithItems,
} from "@/repositories/product.repository";

afterEach(async () => {
  await prisma.bundleItem.deleteMany();
  await prisma.productBundle.deleteMany();
  await prisma.product.deleteMany();
});

describe("product bundles", () => {
  it("creates a bundle with component items", async () => {
    const curryPowder = await createProduct({
      sku: "ORI-CP-100",
      slug: "curry-powder-100g",
      name: "Roasted Curry Powder 100g",
    });
    const chilliPowder = await createProduct({
      sku: "ORI-CHP-100",
      slug: "chilli-powder-100g",
      name: "Chilli Powder 100g",
    });
    const giftSet = await createProduct({
      sku: "ORI-GIFT-001",
      slug: "curry-gift-set",
      name: "Curry Powder Gift Set",
      productType: "Bundle",
    });

    const bundle = await createBundle({
      product: { connect: { id: giftSet.id } },
      priceOverride: "1200.00",
    });
    await addBundleItem({
      bundle: { connect: { id: bundle.id } },
      componentProduct: { connect: { id: curryPowder.id } },
      quantity: 2,
    });
    await addBundleItem({
      bundle: { connect: { id: bundle.id } },
      componentProduct: { connect: { id: chilliPowder.id } },
      quantity: 1,
    });

    const found = await getBundleWithItems(giftSet.id);

    expect(found?.priceOverride?.toFixed(2)).toBe("1200.00");
    expect(found?.items).toHaveLength(2);
    expect(found?.items.map((i) => i.quantity).sort()).toEqual([1, 2]);
  });
});
