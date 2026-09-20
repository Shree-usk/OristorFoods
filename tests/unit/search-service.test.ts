// tests/unit/search-service.test.ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { createStandardPrice } from "@/repositories/pricing.repository";
import {
  registerRecipeSearchProvider,
  resetSearchExtensionsForTesting,
} from "@/services/search-extensions";
import { searchCatalogue } from "@/services/search.service";

afterEach(async () => {
  resetSearchExtensionsForTesting();
  await prisma.product.deleteMany();
});

describe("searchCatalogue", () => {
  it("returns an empty result for a blank query without touching the database", async () => {
    const result = await searchCatalogue("   ");

    expect(result).toEqual({ query: "", products: [], recipes: [], page: 1, pageSize: 12, hasNextPage: false });
  });

  it("returns matching, priced products", async () => {
    const product = await createProduct({
      sku: "SEARCH-SVC-1",
      slug: "search-svc-curry",
      name: "Roasted Curry Powder",
      status: "Published",
    });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "450.00" });

    const result = await searchCatalogue("curry");

    expect(result.products).toEqual([
      {
        id: product.id,
        name: "Roasted Curry Powder",
        href: "/products/search-svc-curry",
        imageSrc: "",
        imageAlt: "Roasted Curry Powder",
        price: 450,
        currency: "LKR",
        inStock: true,
      },
    ]);
  });

  it("omits a matching product with no configured price", async () => {
    await createProduct({
      sku: "SEARCH-SVC-2",
      slug: "search-svc-unpriced",
      name: "Curry Without Price",
      status: "Published",
    });

    const result = await searchCatalogue("curry");

    expect(result.products).toEqual([]);
  });

  it("returns recipes from a registered search provider", async () => {
    registerRecipeSearchProvider(async (query) => [
      { id: "rec1", label: `${query} recipe`, href: "/recipes/rec1", type: "Recipe" as const },
    ]);

    const result = await searchCatalogue("curry");

    expect(result.recipes).toEqual([{ id: "rec1", label: "curry recipe", href: "/recipes/rec1", type: "Recipe" }]);
  });

  it("sets hasNextPage when more results exist beyond pageSize", async () => {
    for (let i = 0; i < 3; i++) {
      const product = await createProduct({
        sku: `SEARCH-SVC-PAGE-${i}`,
        slug: `search-svc-page-${i}`,
        name: `Curry Page ${i}`,
        status: "Published",
      });
      await createStandardPrice({ product: { connect: { id: product.id } }, price: "100.00" });
    }

    const result = await searchCatalogue("curry", { pageSize: 2 });

    expect(result.products).toHaveLength(2);
    expect(result.hasNextPage).toBe(true);
  });

  it("now finds a typo-matched product that the old plain substring match would have missed", async () => {
    const product = await createProduct({
      sku: "SC-TYPO-1",
      slug: "sc-typo-1",
      name: "Chilli Powder",
      status: "Published",
    });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "300.00" });

    // "chili" (one L) never appears as a substring of "Chilli Powder" — a
    // plain `contains` match (STORY-007's original searchPublishedProducts)
    // would return nothing here. The trigram-ranked searchProducts() this
    // task switches searchCatalogue() to use internally still finds it.
    const result = await searchCatalogue("chili powder");

    expect(result.products.map((p) => p.name)).toContain("Chilli Powder");
  });
});
