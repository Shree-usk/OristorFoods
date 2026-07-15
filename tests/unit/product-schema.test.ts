import { describe, expect, it } from "vitest";

import { productCreateSchema } from "@/validation/product.schema";

const validProduct = {
  sku: "ORI-CP-100",
  slug: "curry-powder-100g",
  name: "Roasted Curry Powder 100g",
  status: "Published" as const,
  productType: "Standard" as const,
};

describe("productCreateSchema", () => {
  it("accepts a minimal valid product", () => {
    expect(productCreateSchema.safeParse(validProduct).success).toBe(true);
  });

  it("rejects a product with no SKU", () => {
    const { sku, ...withoutSku } = validProduct;
    void sku;

    expect(productCreateSchema.safeParse(withoutSku).success).toBe(false);
  });

  it("rejects an empty slug", () => {
    const result = productCreateSchema.safeParse({ ...validProduct, slug: "" });

    expect(result.success).toBe(false);
  });

  it("accepts nested nutrition data within range", () => {
    const result = productCreateSchema.safeParse({
      ...validProduct,
      nutrition: {
        servingSize: "1 tsp (5g)",
        calories: 18,
        protein: 0.8,
        fat: 0.7,
        saturatedFat: 0.1,
        carbohydrates: 2.5,
        sugar: 0.3,
        fibre: 1.1,
        sodium: 2,
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects negative nutrition values", () => {
    const result = productCreateSchema.safeParse({
      ...validProduct,
      nutrition: {
        servingSize: "1 tsp (5g)",
        calories: -18,
        protein: 0.8,
        fat: 0.7,
        saturatedFat: 0.1,
        carbohydrates: 2.5,
        sugar: 0.3,
        fibre: 1.1,
        sodium: 2,
      },
    });

    expect(result.success).toBe(false);
  });
});
