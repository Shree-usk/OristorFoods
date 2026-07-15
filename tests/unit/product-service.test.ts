// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { getProductBySlug, getProductBySlugForAdmin } from "@/services/product.service";

afterEach(async () => {
  await prisma.product.deleteMany();
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
