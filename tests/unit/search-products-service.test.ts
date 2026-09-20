// tests/unit/search-products-service.test.ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createAllergen, createProduct } from "@/repositories/product.repository";
import { createStandardPrice } from "@/repositories/pricing.repository";
import { searchProducts } from "@/services/search.service";

afterEach(async () => {
  await prisma.product.deleteMany();
  await prisma.allergen.deleteMany();
});

describe("searchProducts", () => {
  it("returns an empty result for a blank query without touching the database", async () => {
    const result = await searchProducts("   ");

    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 24, hasNextPage: false });
  });

  it("returns matching, priced products ordered by relevance by default", async () => {
    const exact = await createProduct({
      sku: "SPS-1",
      slug: "sps-1",
      name: "Curry Powder",
      status: "Published",
    });
    // Contains the full query as a literal substring (guaranteed tier-2
    // match via the LIKE condition) — deliberately NOT relying on the
    // trigram similarity threshold here: empirically,
    // similarity("Roasted Curry Blend", "Curry Powder") = 0.222, *below*
    // the 0.3 cutoff, so a fixture that depended on fuzzy similarity alone
    // would silently fail to match at all.
    const contains = await createProduct({
      sku: "SPS-2",
      slug: "sps-2",
      name: "Deluxe Curry Powder Mix",
      status: "Published",
    });
    await createStandardPrice({ product: { connect: { id: exact.id } }, price: "450.00" });
    await createStandardPrice({ product: { connect: { id: contains.id } }, price: "500.00" });

    const result = await searchProducts("Curry Powder");

    expect(result.items.map((i) => i.name)).toEqual(["Curry Powder", "Deluxe Curry Powder Mix"]);
    expect(result.items[0].price).toBe(450);
  });

  it("omits a matching product with no configured price", async () => {
    await createProduct({ sku: "SPS-3", slug: "sps-3", name: "Curry No Price", status: "Published" });

    const result = await searchProducts("curry");

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("applies allergen exclusion filters on top of the search results", async () => {
    const peanuts = await createAllergen({ name: "Peanuts-SPS" });
    const withPeanuts = await createProduct({
      sku: "SPS-4",
      slug: "sps-4",
      name: "Curry Peanut Mix",
      status: "Published",
      allergens: { connect: [{ id: peanuts.id }] },
    });
    const withoutPeanuts = await createProduct({
      sku: "SPS-5",
      slug: "sps-5",
      name: "Curry Plain",
      status: "Published",
    });
    await createStandardPrice({ product: { connect: { id: withPeanuts.id } }, price: "100.00" });
    await createStandardPrice({ product: { connect: { id: withoutPeanuts.id } }, price: "100.00" });

    const result = await searchProducts("curry", { filters: { allergens: ["Peanuts-SPS"] } });

    expect(result.items.map((i) => i.name)).toEqual(["Curry Plain"]);
  });

  it("uses newest ordering instead of relevance when an explicit sort is given", async () => {
    // "Curry" is an exact match for the query (tier 4); "Amazing Curry Blend"
    // only contains "curry" as a substring, not as a prefix (tier 2) — an
    // unambiguous tier gap, unlike two names that both start with "Curry"
    // (which would tie at tier 3 and make this test's premise unclear).
    const exactOlder = await createProduct({
      sku: "SPS-6",
      slug: "sps-6",
      name: "Curry",
      status: "Published",
      publishedAt: new Date("2026-01-01"),
    });
    const containsNewer = await createProduct({
      sku: "SPS-7",
      slug: "sps-7",
      name: "Amazing Curry Blend",
      status: "Published",
      publishedAt: new Date("2026-06-01"),
    });
    await createStandardPrice({ product: { connect: { id: exactOlder.id } }, price: "100.00" });
    await createStandardPrice({ product: { connect: { id: containsNewer.id } }, price: "100.00" });

    const relevanceResult = await searchProducts("curry");
    expect(relevanceResult.items.map((i) => i.name)).toEqual(["Curry", "Amazing Curry Blend"]);

    const newestResult = await searchProducts("curry", { sort: "newest" });
    expect(newestResult.items.map((i) => i.name)).toEqual(["Amazing Curry Blend", "Curry"]);
  });

  it("paginates and reports an accurate total after filtering", async () => {
    for (let i = 0; i < 3; i++) {
      const product = await createProduct({
        sku: `SPS-PAGE-${i}`,
        slug: `sps-page-${i}`,
        name: `Curry Page ${i}`,
        status: "Published",
      });
      await createStandardPrice({ product: { connect: { id: product.id } }, price: "100.00" });
    }

    const result = await searchProducts("curry", { pageSize: 2 });

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(3);
    expect(result.hasNextPage).toBe(true);
  });
});
