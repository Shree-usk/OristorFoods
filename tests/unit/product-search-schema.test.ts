import { describe, expect, it } from "vitest";

import { productSearchQuerySchema } from "@/validation/product-search.schema";

describe("productSearchQuerySchema", () => {
  it("trims q and defaults page/sort like the base listing schema", () => {
    const result = productSearchQuerySchema.parse({ q: "  curry  " });

    expect(result.q).toBe("curry");
    expect(result.page).toBe(1);
    expect(result.sort).toBe("newest");
  });

  it("accepts sort: relevance", () => {
    const result = productSearchQuerySchema.parse({ q: "curry", sort: "relevance" });

    expect(result.sort).toBe("relevance");
  });

  it("degrades a missing q to an empty string instead of throwing", () => {
    expect(productSearchQuerySchema.parse({}).q).toBe("");
  });

  it("still validates the shared filter fields (e.g. inStock)", () => {
    const result = productSearchQuerySchema.parse({ q: "curry", inStock: "true" });

    expect(result.inStock).toBe(true);
  });

  it("does not include category/collection fields", () => {
    const result = productSearchQuerySchema.parse({ q: "curry", category: "spices" });

    expect(result).not.toHaveProperty("category");
  });
});
