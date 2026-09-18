import { describe, expect, it } from "vitest";

import { productSlugParamSchema, recentlyViewedItemSchema } from "@/validation/product-detail.schema";

describe("productSlugParamSchema", () => {
  it("accepts a valid slug", () => {
    expect(productSlugParamSchema.parse({ slug: "roasted-curry-powder-100g" })).toEqual({
      slug: "roasted-curry-powder-100g",
    });
  });

  it("rejects an empty slug", () => {
    expect(() => productSlugParamSchema.parse({ slug: "" })).toThrow();
  });
});

describe("recentlyViewedItemSchema", () => {
  it("accepts a well-formed recently-viewed item", () => {
    const item = {
      id: "1",
      name: "Curry Powder",
      href: "/products/curry-powder",
      imageSrc: "/curry.jpg",
      imageAlt: "Curry Powder",
      price: 550,
      currency: "LKR",
      inStock: true,
    };

    expect(recentlyViewedItemSchema.parse(item)).toEqual(item);
  });

  it("rejects an item missing a required field", () => {
    expect(() => recentlyViewedItemSchema.parse({ id: "1", name: "Curry Powder" })).toThrow();
  });
});
