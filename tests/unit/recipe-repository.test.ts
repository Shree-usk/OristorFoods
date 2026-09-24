// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { RecipeFilters } from "@/lib/recipe-listing-values";
import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import {
  buildRecipeOrderBy,
  buildRecipeWhere,
  findActiveCategoriesWithPublishedRecipes,
  findActiveDietaryTagsWithPublishedRecipes,
  findFeaturedRecipes,
  findPublishedRecipeBySlug,
  findPublishedRecipes,
  findRecipesByProductId,
  findRelatedRecipes,
  incrementRecipeViewCount,
} from "@/repositories/recipe.repository";
import { cleanupRecipes, makeCategory, makeDietaryTag, makeRecipe } from "./recipe-fixtures";

afterEach(async () => {
  await cleanupRecipes();
  await prisma.product.deleteMany();
});

async function titlesFor(filters: RecipeFilters, sort: Parameters<typeof buildRecipeOrderBy>[0] = "newest") {
  const { rows } = await findPublishedRecipes({
    where: buildRecipeWhere(filters),
    orderBy: buildRecipeOrderBy(sort),
    skip: 0,
    take: 50,
  });
  return rows.map((row) => row.title);
}

describe("Published only", () => {
  it("never returns Draft, Review, Approved or Archived recipes, whatever the filters", async () => {
    const category = await makeCategory({ slug: "shared-category" });
    const tag = await makeDietaryTag({ slug: "shared-tag" });
    const shared = { difficulty: "Easy" as const, prepTimeMinutes: 5, cookTimeMinutes: 5, dietaryTagIds: [tag.id], isFeatured: true };
    await makeRecipe(category.id, { ...shared, title: "Shared Published" });
    for (const status of ["Draft", "Review", "Approved", "Archived"] as const) {
      await makeRecipe(category.id, { ...shared, title: `Shared ${status}`, status });
    }

    const combinations: RecipeFilters[] = [
      {},
      { category: "shared-category" },
      { difficulty: ["easy"] },
      { time: ["under-15"] },
      { diet: ["shared-tag"] },
      { q: "shared" },
      { category: "shared-category", difficulty: ["easy"], time: ["under-15"], diet: ["shared-tag"], q: "shared" },
    ];
    for (const filters of combinations) {
      expect(await titlesFor(filters)).toEqual(["Shared Published"]);
    }
    expect((await findFeaturedRecipes(10)).map((row) => row.title)).toEqual(["Shared Published"]);
  });
});

describe("filters", () => {
  it("puts boundary times into exactly one range", async () => {
    const category = await makeCategory();
    for (const total of [14, 15, 29, 30, 59, 60]) {
      await makeRecipe(category.id, { title: `T${total}`, prepTimeMinutes: 0, cookTimeMinutes: total });
    }

    expect(await titlesFor({ time: ["under-15"] }, "time")).toEqual(["T14"]);
    expect(await titlesFor({ time: ["15-30"] }, "time")).toEqual(["T15", "T29"]);
    expect(await titlesFor({ time: ["30-60"] }, "time")).toEqual(["T30", "T59"]);
    expect(await titlesFor({ time: ["60-plus"] }, "time")).toEqual(["T60"]);
    expect(await titlesFor({ time: ["under-15", "60-plus"] }, "time")).toEqual(["T14", "T60"]);
  });

  it("requires every dietary tag (AND) but any difficulty (OR)", async () => {
    const category = await makeCategory();
    const vegan = await makeDietaryTag({ slug: "vegan" });
    const spicy = await makeDietaryTag({ slug: "spicy" });
    await makeRecipe(category.id, { title: "Both", difficulty: "Easy", dietaryTagIds: [vegan.id, spicy.id] });
    await makeRecipe(category.id, { title: "Vegan only", difficulty: "Hard", dietaryTagIds: [vegan.id] });
    await makeRecipe(category.id, { title: "Medium", difficulty: "Medium" });

    expect(await titlesFor({ diet: ["vegan", "spicy"] })).toEqual(["Both"]);
    expect((await titlesFor({ diet: ["vegan"] })).sort()).toEqual(["Both", "Vegan only"]);
    expect((await titlesFor({ difficulty: ["easy", "hard"] })).sort()).toEqual(["Both", "Vegan only"]);
    expect(await titlesFor({ diet: ["unknown-tag"] })).toEqual([]);
  });

  it("ignores an Inactive dietary tag when filtering", async () => {
    const category = await makeCategory();
    const hidden = await makeDietaryTag({ slug: "hidden", status: "Inactive" });
    await makeRecipe(category.id, { title: "Tagged", dietaryTagIds: [hidden.id] });

    expect(await titlesFor({ diet: ["hidden"] })).toEqual([]);
  });

  it("matches nothing for an Inactive or unknown category", async () => {
    const inactive = await makeCategory({ slug: "retired", status: "Inactive" });
    await makeRecipe(inactive.id, { title: "In retired category" });

    expect(await titlesFor({ category: "retired" })).toEqual([]);
    expect(await titlesFor({ category: "no-such-category" })).toEqual([]);
    expect(await titlesFor({})).toEqual(["In retired category"]);
  });

  it("searches title and short description case-insensitively, every word required, wildcards literal", async () => {
    const category = await makeCategory();
    await makeRecipe(category.id, { title: "Coconut Sambol", shortDescription: "Fresh coconut with chilli." });
    await makeRecipe(category.id, { title: "Dhal Curry", shortDescription: "Lentils with COCONUT milk." });
    await makeRecipe(category.id, { title: "100% Kithul Treacle Pudding" });
    await makeRecipe(category.id, { title: "1000 Layer Cake" });

    expect((await titlesFor({ q: "coconut" })).sort()).toEqual(["Coconut Sambol", "Dhal Curry"]);
    expect(await titlesFor({ q: "coconut lentils" })).toEqual(["Dhal Curry"]);
    expect(await titlesFor({ q: "100%" })).toEqual(["100% Kithul Treacle Pudding"]);
  });
});

describe("sorting and pagination", () => {
  it("sorts by views, rating (nulls last) and newest (nulls last)", async () => {
    const category = await makeCategory();
    await makeRecipe(category.id, { title: "A", viewCount: 10, avgRating: 4.2, ratingCount: 3, publishedAt: new Date("2026-01-01") });
    await makeRecipe(category.id, { title: "B", viewCount: 30, avgRating: null, ratingCount: 0, publishedAt: null });
    await makeRecipe(category.id, { title: "C", viewCount: 20, avgRating: 4.8, ratingCount: 9, publishedAt: new Date("2026-06-01") });

    expect(await titlesFor({}, "popular")).toEqual(["B", "C", "A"]);
    expect(await titlesFor({}, "rating")).toEqual(["C", "A", "B"]);
    expect(await titlesFor({}, "newest")).toEqual(["C", "A", "B"]);
  });

  it("pages with a correct total", async () => {
    const category = await makeCategory();
    for (let i = 1; i <= 5; i += 1) {
      await makeRecipe(category.id, { title: `P${i}`, prepTimeMinutes: 0, cookTimeMinutes: i });
    }

    const { rows, total } = await findPublishedRecipes({
      where: buildRecipeWhere({}),
      orderBy: buildRecipeOrderBy("time"),
      skip: 2,
      take: 2,
    });

    expect(total).toBe(5);
    expect(rows.map((row) => row.title)).toEqual(["P3", "P4"]);
  });

  it("selects card fields with category name and Active tag names in tag sortOrder", async () => {
    const category = await makeCategory({ name: "Curries" });
    const spicy = await makeDietaryTag({ name: "Spicy", sortOrder: 2 });
    const vegan = await makeDietaryTag({ name: "Vegan", sortOrder: 1 });
    const hidden = await makeDietaryTag({ name: "Hidden", status: "Inactive" });
    await makeRecipe(category.id, { title: "Card", dietaryTagIds: [spicy.id, vegan.id, hidden.id], avgRating: 4.5, ratingCount: 2 });

    const { rows } = await findPublishedRecipes({ where: buildRecipeWhere({}), orderBy: buildRecipeOrderBy("newest"), skip: 0, take: 1 });

    expect(rows[0].category.name).toBe("Curries");
    expect(rows[0].dietaryTags.map((link) => link.dietaryTag.name)).toEqual(["Vegan", "Spicy"]);
    expect(rows[0].avgRating?.toNumber()).toBe(4.5);
  });
});

describe("facets", () => {
  it("lists only Active categories and tags that have a Published recipe, in sortOrder", async () => {
    const snacks = await makeCategory({ name: "Snacks", slug: "snacks", sortOrder: 2 });
    const curries = await makeCategory({ name: "Curries", slug: "curries", sortOrder: 1 });
    const draftOnly = await makeCategory({ name: "Draft only", slug: "draft-only" });
    const inactive = await makeCategory({ name: "Inactive", slug: "inactive", status: "Inactive" });
    await makeCategory({ name: "Empty", slug: "empty" });
    const vegan = await makeDietaryTag({ name: "Vegan", slug: "vegan" });
    const unused = await makeDietaryTag({ name: "Unused", slug: "unused" });
    const retired = await makeDietaryTag({ name: "Retired", slug: "retired", status: "Inactive" });

    await makeRecipe(snacks.id, { dietaryTagIds: [vegan.id, retired.id] });
    await makeRecipe(curries.id);
    await makeRecipe(draftOnly.id, { status: "Draft", dietaryTagIds: [unused.id] });
    await makeRecipe(inactive.id);

    expect(await findActiveCategoriesWithPublishedRecipes()).toEqual([
      { name: "Curries", slug: "curries" },
      { name: "Snacks", slug: "snacks" },
    ]);
    expect(await findActiveDietaryTagsWithPublishedRecipes()).toEqual([{ name: "Vegan", slug: "vegan" }]);
  });
});

describe("findFeaturedRecipes", () => {
  it("returns Published featured recipes, newest first, up to the limit", async () => {
    const category = await makeCategory();
    await makeRecipe(category.id, { title: "Old", isFeatured: true, publishedAt: new Date("2026-01-01") });
    await makeRecipe(category.id, { title: "New", isFeatured: true, publishedAt: new Date("2026-06-01") });
    await makeRecipe(category.id, { title: "Newest", isFeatured: true, publishedAt: new Date("2026-09-01") });
    await makeRecipe(category.id, { title: "Not featured" });
    await makeRecipe(category.id, { title: "Draft", status: "Draft", isFeatured: true });

    expect((await findFeaturedRecipes(2)).map((row) => row.title)).toEqual(["Newest", "New"]);
  });
});

describe("findPublishedRecipeBySlug", () => {
  it("returns null for a slug that doesn't exist", async () => {
    const result = await findPublishedRecipeBySlug("does-not-exist");
    expect(result).toBeNull();
  });

  it("returns null for a Draft recipe", async () => {
    const category = await makeCategory();
    await makeRecipe(category.id, { status: "Draft", slug: "draft-recipe" });

    const result = await findPublishedRecipeBySlug("draft-recipe");

    expect(result).toBeNull();
  });

  it("returns ingredients ordered by sortOrder and steps ordered by stepNumber", async () => {
    const category = await makeCategory();
    await makeRecipe(category.id, {
      status: "Published",
      slug: "ordered-recipe",
      ingredients: [
        { displayText: "Second", sortOrder: 2 },
        { displayText: "First", sortOrder: 1 },
      ],
      steps: [
        { stepNumber: 2, instruction: "Second step" },
        { stepNumber: 1, instruction: "First step" },
      ],
    });

    const result = await findPublishedRecipeBySlug("ordered-recipe");

    expect(result?.ingredients.map((i) => i.displayText)).toEqual(["First", "Second"]);
    expect(result?.steps.map((s) => s.instruction)).toEqual(["First step", "Second step"]);
  });
});

describe("findRelatedRecipes", () => {
  it("excludes the recipe itself and returns only Published recipes sharing category or cuisine", async () => {
    const category = await makeCategory();
    const target = await makeRecipe(category.id, { status: "Published", slug: "target", cuisine: "Sri Lankan" });
    await makeRecipe(category.id, { status: "Published", slug: "same-category" });
    await makeRecipe(category.id, { status: "Draft", slug: "draft-same-category" });

    const related = await findRelatedRecipes(
      { id: target.id, categoryId: target.categoryId, cuisine: target.cuisine },
      6,
    );

    expect(related.map((r) => r.slug)).toContain("same-category");
    expect(related.map((r) => r.slug)).not.toContain("target");
    expect(related.map((r) => r.slug)).not.toContain("draft-same-category");
  });
});

describe("findRecipesByProductId", () => {
  it("returns Published recipes whose ingredients reference the product", async () => {
    const product = await createProduct({ sku: "RECIPE-SKU-1", slug: "recipe-sku-1", name: "Test Product" });
    const category = await makeCategory();
    await makeRecipe(category.id, {
      status: "Published",
      slug: "uses-product",
      ingredients: [{ productId: product.id, displayText: "1 unit" }],
    });

    const result = await findRecipesByProductId(product.id, 6);

    expect(result.map((r) => r.slug)).toEqual(["uses-product"]);
  });
});

describe("incrementRecipeViewCount", () => {
  it("increments viewCount by 1", async () => {
    const category = await makeCategory();
    const recipe = await makeRecipe(category.id, { status: "Published", slug: "view-me", viewCount: 5 });

    await incrementRecipeViewCount(recipe.id);

    const updated = await prisma.recipe.findUniqueOrThrow({ where: { id: recipe.id } });
    expect(updated.viewCount).toBe(6);
  });
});
