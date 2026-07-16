import { describe, expect, it } from "vitest";

import { productListingQuerySchema } from "@/validation/product-listing.schema";

describe("productListingQuerySchema", () => {
  it("fills in defaults for an empty query", () => {
    const result = productListingQuerySchema.parse({});

    expect(result).toEqual({
      page: 1,
      pageSize: 24,
      sort: "newest",
    });
  });

  it("coerces numeric and comma-separated fields", () => {
    const result = productListingQuerySchema.parse({
      page: "2",
      pageSize: "10",
      priceMin: "100",
      priceMax: "500",
      allergens: "peanuts,gluten",
      brands: "oristor",
      inStock: "true",
    });

    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
    expect(result.priceMin).toBe(100);
    expect(result.priceMax).toBe(500);
    expect(result.allergens).toEqual(["peanuts", "gluten"]);
    expect(result.brands).toEqual(["oristor"]);
    expect(result.inStock).toBe(true);
  });

  it("falls back to defaults for a malformed sort value instead of throwing", () => {
    const result = productListingQuerySchema.parse({ sort: "not-a-real-sort" });

    expect(result.sort).toBe("newest");
  });

  it("falls back to the default page for a negative or zero page number", () => {
    expect(productListingQuerySchema.parse({ page: "-1" }).page).toBe(1);
    expect(productListingQuerySchema.parse({ page: "0" }).page).toBe(1);
  });

  it("caps pageSize at 60 by falling back to the default rather than clamping", () => {
    const result = productListingQuerySchema.parse({ pageSize: "999" });

    expect(result.pageSize).toBe(24);
  });

  it("never throws, even for completely garbage input", () => {
    expect(() =>
      productListingQuerySchema.parse({
        page: "abc",
        priceMin: "not-a-number",
        inStock: "maybe",
      }),
    ).not.toThrow();
  });
});
