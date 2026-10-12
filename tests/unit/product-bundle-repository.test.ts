// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createBundleItem, createBundle, findBundleByProductId } from "@/repositories/bundle.repository";
import { createProduct } from "@/repositories/product.repository";

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
      bundleType: "Fixed",
      name: "Curry Powder Gift Set",
      discountType: "FixedPrice",
      fixedPrice: "1200.00",
    });
    await createBundleItem({
      bundle: { connect: { id: bundle.id } },
      componentProduct: { connect: { id: curryPowder.id } },
      quantity: 2,
    });
    await createBundleItem({
      bundle: { connect: { id: bundle.id } },
      componentProduct: { connect: { id: chilliPowder.id } },
      quantity: 1,
    });

    const found = await findBundleByProductId(giftSet.id);

    expect(found?.fixedPrice?.toFixed(2)).toBe("1200.00");
    expect(found?.items).toHaveLength(2);
    expect(found?.items.map((i) => i.quantity).sort()).toEqual([1, 2]);
  });
});
