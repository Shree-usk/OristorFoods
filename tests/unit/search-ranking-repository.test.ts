// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createCategory } from "@/repositories/category.repository";
import { addProductIngredient, createProduct } from "@/repositories/product.repository";
import { findClosestNameSuggestion, findRankedProductMatches } from "@/repositories/search.repository";

afterEach(async () => {
  await prisma.productIngredient.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
});

describe("findRankedProductMatches", () => {
  it("ranks an exact name match above a prefix match, above a contains match, above a description-only match", async () => {
    // A single-word query with each fixture's tier controlled by guaranteed
    // string containment/prefix logic — deliberately not relying on
    // trigram similarity scores for tier placement (verified empirically
    // during this plan's design that similarity() thresholds are easy to
    // misjudge by hand — see search-products-service.test.ts's note on
    // this same pitfall).
    const exact = await createProduct({
      sku: "RANK-1",
      slug: "rank-1",
      name: "Curry",
      status: "Published",
    });
    const prefix = await createProduct({
      sku: "RANK-2",
      slug: "rank-2",
      name: "Curry Blend",
      status: "Published",
    });
    const contains = await createProduct({
      sku: "RANK-3",
      slug: "rank-3",
      name: "Roasted Curry Mix",
      status: "Published",
    });
    const descriptionOnly = await createProduct({
      sku: "RANK-4",
      slug: "rank-4",
      name: "Spice Mix",
      shortDescription: "Pairs well with curry",
      status: "Published",
    });

    const matches = await findRankedProductMatches("curry");
    const byId = new Map(matches.map((m) => [m.productId, m]));

    expect(byId.get(exact.id)?.rankTier).toBe(4);
    expect(byId.get(prefix.id)?.rankTier).toBe(3);
    expect(byId.get(contains.id)?.rankTier).toBe(2);
    expect(byId.get(descriptionOnly.id)?.rankTier).toBe(1);
    // Sorted by tier descending
    expect(matches[0].productId).toBe(exact.id);
  });

  it("is typo-tolerant: a common misspelling still matches via trigram similarity", async () => {
    const product = await createProduct({
      sku: "RANK-5",
      slug: "rank-5",
      name: "Chilli Powder",
      status: "Published",
    });

    const matches = await findRankedProductMatches("chili powder");

    expect(matches.map((m) => m.productId)).toContain(product.id);
  });

  it("excludes non-Published products", async () => {
    await createProduct({ sku: "RANK-6", slug: "rank-6", name: "Curry Draft", status: "Draft" });

    const matches = await findRankedProductMatches("curry");

    expect(matches).toEqual([]);
  });

  it("matches an ingredient name at the lowest tier", async () => {
    const product = await createProduct({
      sku: "RANK-7",
      slug: "rank-7",
      name: "Mystery Blend",
      status: "Published",
    });
    await addProductIngredient({
      product: { connect: { id: product.id } },
      name: "Fenugreek",
    });

    const matches = await findRankedProductMatches("fenugreek");

    expect(matches.map((m) => m.productId)).toEqual([product.id]);
    expect(matches[0].rankTier).toBe(1);
  });

  it("matches a category name at the lowest tier", async () => {
    const category = await createCategory({ name: "Spice Blends Unique", slug: "rank-cat-1" });
    const product = await createProduct({
      sku: "RANK-8",
      slug: "rank-8",
      name: "Unrelated Name",
      status: "Published",
      categories: { connect: [{ id: category.id }] },
    });

    const matches = await findRankedProductMatches("Spice Blends Unique");

    expect(matches.map((m) => m.productId)).toEqual([product.id]);
  });

  it("returns an empty array for a blank query", async () => {
    expect(await findRankedProductMatches("   ")).toEqual([]);
  });
});

describe("findClosestNameSuggestion", () => {
  it("returns the closest product name above the similarity threshold", async () => {
    await createProduct({
      sku: "RANK-9",
      slug: "rank-9",
      name: "Ginger Powder",
      status: "Published",
    });

    const suggestion = await findClosestNameSuggestion("ginger powde");

    expect(suggestion).toBe("Ginger Powder");
  });

  it("returns null when nothing is close enough", async () => {
    await createProduct({
      sku: "RANK-10",
      slug: "rank-10",
      name: "Ginger Powder",
      status: "Published",
    });

    const suggestion = await findClosestNameSuggestion("zzz-completely-unrelated-zzz");

    expect(suggestion).toBeNull();
  });

  it("returns null for a blank query", async () => {
    expect(await findClosestNameSuggestion("")).toBeNull();
  });
});
