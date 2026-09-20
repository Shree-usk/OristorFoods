// tests/unit/search-suggestions-service.test.ts
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { createCategory } from "@/repositories/category.repository";
import {
  findDidYouMeanSuggestion,
  getSearchSuggestions,
  logProductSearch,
} from "@/services/search.service";

afterEach(async () => {
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
});

describe("getSearchSuggestions", () => {
  it("returns an empty array for a blank query", async () => {
    expect(await getSearchSuggestions("   ")).toEqual([]);
  });

  it("returns product suggestions sorted by rank", async () => {
    const exact = await createProduct({
      sku: "SUGG-1",
      slug: "sugg-1",
      name: "Curry Powder",
      status: "Published",
    });
    // Guaranteed tier-2 via substring containment, not fuzzy similarity —
    // see search-products-service.test.ts's note on why "Roasted Curry
    // Blend" specifically does NOT reliably match "Curry Powder" (measured
    // similarity 0.222, below the 0.3 cutoff).
    const contains = await createProduct({
      sku: "SUGG-2",
      slug: "sugg-2",
      name: "Deluxe Curry Powder Mix",
      status: "Published",
    });

    const suggestions = await getSearchSuggestions("Curry Powder");

    expect(suggestions.map((s) => s.label)).toEqual(["Curry Powder", "Deluxe Curry Powder Mix"]);
    expect(suggestions[0]).toEqual({
      id: exact.id,
      label: "Curry Powder",
      href: "/products/sugg-1",
      type: "Product",
    });
    expect(suggestions.map((s) => s.id)).toContain(contains.id);
  });

  it("excludes description-only (tier-1) matches", async () => {
    await createProduct({
      sku: "SUGG-3",
      slug: "sugg-3",
      name: "Spice Mix",
      shortDescription: "Great with curry dishes",
      status: "Published",
    });

    const suggestions = await getSearchSuggestions("curry");

    expect(suggestions).toEqual([]);
  });

  it("includes category-name matches, typed as Category", async () => {
    const category = await createCategory({
      name: "Spices & Curry Powders",
      slug: "spices-curry-powders",
    });

    const suggestions = await getSearchSuggestions("Spices");

    expect(suggestions).toContainEqual({
      id: category.id,
      label: "Spices & Curry Powders",
      href: "/products?category=spices-curry-powders",
      type: "Category",
    });
  });

  it("caps results at the given limit", async () => {
    for (let i = 0; i < 5; i++) {
      await createProduct({
        sku: `SUGG-CAP-${i}`,
        slug: `sugg-cap-${i}`,
        name: `Curry ${i}`,
        status: "Published",
      });
    }

    const suggestions = await getSearchSuggestions("curry", 3);

    expect(suggestions).toHaveLength(3);
  });
});

describe("findDidYouMeanSuggestion", () => {
  it("delegates to the repository and returns a corrected name", async () => {
    await createProduct({
      sku: "SUGG-4",
      slug: "sugg-4",
      name: "Ginger Powder",
      status: "Published",
    });

    expect(await findDidYouMeanSuggestion("ginger powde")).toBe("Ginger Powder");
  });

  it("returns null for a blank query", async () => {
    expect(await findDidYouMeanSuggestion("")).toBeNull();
  });
});

describe("logProductSearch", () => {
  it("does not throw when called", () => {
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});

    expect(() => logProductSearch({ query: "curry", resultCount: 3 })).not.toThrow();

    spy.mockRestore();
  });
});
