// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { createStandardPrice } from "@/repositories/pricing.repository";
import { getEntryBySlug, listCategories, listEntries, listFeaturedEntries } from "@/services/food-academy.service";
import { getRecipesByIds } from "@/services/recipe.service";
import { cleanupRecipes, makeCategory, makeFoodAcademyCategory, makeFoodAcademyEntry, makeRecipe } from "./recipe-fixtures";

afterEach(async () => {
  await cleanupRecipes();
  await prisma.product.deleteMany();
});

describe("listEntries", () => {
  it("maps rows to FoodAcademyEntryCard and echoes page/pageSize", async () => {
    const category = await makeFoodAcademyCategory({ name: "Techniques", slug: "techniques" });
    await makeFoodAcademyEntry({ title: "Entry One", categoryId: category.id });

    const result = await listEntries({ page: 1, pageSize: 10 });
    expect(result).toMatchObject({ page: 1, pageSize: 10, total: 1 });
    expect(result.entries[0]).toMatchObject({
      title: "Entry One",
      categoryName: "Techniques",
      categorySlug: "techniques",
      href: expect.stringContaining("/food-academy/"),
    });
  });

  it("filters by category and contentType", async () => {
    const category = await makeFoodAcademyCategory({ slug: "spice-guide" });
    const other = await makeFoodAcademyCategory({ slug: "storage" });
    await makeFoodAcademyEntry({ title: "Spice Course", categoryId: category.id, contentType: "Course" });
    await makeFoodAcademyEntry({ title: "Storage Article", categoryId: other.id, contentType: "Article" });

    expect((await listEntries({ page: 1, pageSize: 10, category: "spice-guide" })).entries.map((e) => e.title)).toEqual(["Spice Course"]);
    expect((await listEntries({ page: 1, pageSize: 10, contentType: "Article" })).entries.map((e) => e.title)).toEqual(["Storage Article"]);
  });
});

describe("listFeaturedEntries", () => {
  it("returns only featured Published entries, up to the limit", async () => {
    const category = await makeFoodAcademyCategory();
    await makeFoodAcademyEntry({ title: "Featured", categoryId: category.id, isFeatured: true });
    await makeFoodAcademyEntry({ title: "Not Featured", categoryId: category.id, isFeatured: false });

    expect((await listFeaturedEntries()).map((e) => e.title)).toEqual(["Featured"]);
  });
});

describe("listCategories", () => {
  it("returns active categories that have at least one Published entry", async () => {
    const category = await makeFoodAcademyCategory({ name: "Ingredients" });
    await makeFoodAcademyEntry({ categoryId: category.id });
    expect((await listCategories()).map((c) => c.name)).toEqual(["Ingredients"]);
  });
});

describe("getEntryBySlug", () => {
  it("returns null for missing/Draft, maps sections/relatedRecipes/relatedProducts/relatedEntries for a real entry", async () => {
    expect(await getEntryBySlug("nope")).toBeNull();

    const category = await makeFoodAcademyCategory({ slug: "knife-skills" });
    const recipeCategory = await makeCategory();
    const recipe = await makeRecipe(recipeCategory.id, { title: "Knife Curry" });
    const draftProduct = await createProduct({ sku: "SKU-FA-2", slug: "draft-product-fa", name: "Draft Thing", status: "Draft" });
    // createProduct defaults status to "Draft" (schema.prisma), so this must be set explicitly
    // or the test would pass for the wrong reason (both products excluded, not just the Draft one).
    const publishedProduct = await createProduct({ sku: "SKU-FA-3", slug: "published-product-fa", name: "Real Thing", status: "Published" });
    // getProductsByIds silently drops any product with no resolvable price
    // (pricing.service.ts's resolvePricesForProducts) — without this, the
    // test would fail even with the status fix above, for an unrelated
    // reason (no price, not "not Published").
    await createStandardPrice({ product: { connect: { id: publishedProduct.id } }, price: "500.00" });

    await makeFoodAcademyEntry({ slug: "draft", categoryId: category.id, status: "Draft" });
    await makeFoodAcademyEntry({ slug: "related", categoryId: category.id });
    await makeFoodAcademyEntry({
      slug: "full",
      categoryId: category.id,
      recipeIds: [recipe.id],
      productIds: [draftProduct.id, publishedProduct.id],
      sections: [{ sectionNumber: 1, title: "Step One", bodyContent: "Do this." }],
    });

    expect(await getEntryBySlug("draft")).toBeNull();

    const result = await getEntryBySlug("full");
    expect(result?.sections).toEqual([{ id: expect.any(String), sectionNumber: 1, title: "Step One", bodyContent: "Do this.", imageUrl: null }]);
    expect(result?.relatedRecipes.map((r) => r.title)).toEqual(["Knife Curry"]);
    // The Draft product must never appear, even though it was linked.
    expect(result?.relatedProducts.map((p) => p.name)).toEqual(["Real Thing"]);
    expect(result?.relatedEntries.map((e) => e.slug)).toEqual(["related"]);
  });
});

describe("getRecipesByIds (recipe.service.ts)", () => {
  it("maps repository rows to RecipePreview shape, Published only", async () => {
    const recipeCategory = await makeCategory();
    const published = await makeRecipe(recipeCategory.id, { title: "Preview Recipe" });
    const draft = await makeRecipe(recipeCategory.id, { title: "Draft Recipe", status: "Draft" });

    const results = await getRecipesByIds([published.id, draft.id]);
    expect(results).toEqual([{ id: published.id, title: "Preview Recipe", slug: published.slug, imageSrc: expect.any(String) }]);
  });
});
