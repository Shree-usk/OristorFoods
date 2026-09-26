// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { findRecipesByIds } from "@/repositories/recipe.repository";
import {
  findActiveFoodAcademyCategories,
  findFeaturedFoodAcademyEntries,
  findPublishedFoodAcademyEntries,
  findPublishedFoodAcademyEntryBySlug,
  findRelatedFoodAcademyEntries,
} from "@/repositories/food-academy.repository";
import { cleanupRecipes, makeCategory, makeFoodAcademyCategory, makeFoodAcademyEntry, makeRecipe } from "./recipe-fixtures";

afterEach(async () => {
  await cleanupRecipes();
  await prisma.product.deleteMany();
});

describe("findPublishedFoodAcademyEntries", () => {
  it("only returns Published entries, filtered by category and contentType when given", async () => {
    const category = await makeFoodAcademyCategory({ slug: "knife-skills" });
    const otherCategory = await makeFoodAcademyCategory({ slug: "storage" });
    await makeFoodAcademyEntry({ title: "Published Article", categoryId: category.id, contentType: "Article" });
    await makeFoodAcademyEntry({ title: "Draft Article", categoryId: category.id, status: "Draft" });
    await makeFoodAcademyEntry({ title: "Published Course", categoryId: category.id, contentType: "Course" });
    await makeFoodAcademyEntry({ title: "Other Category", categoryId: otherCategory.id });

    const all = await findPublishedFoodAcademyEntries({ where: {}, skip: 0, take: 10 });
    expect(all.rows.map((r) => r.title).sort()).toEqual(["Other Category", "Published Article", "Published Course"]);

    const byCategory = await findPublishedFoodAcademyEntries({ where: { categoryId: category.id }, skip: 0, take: 10 });
    expect(byCategory.rows.map((r) => r.title).sort()).toEqual(["Published Article", "Published Course"]);

    const byContentType = await findPublishedFoodAcademyEntries({ where: { contentType: "Course" }, skip: 0, take: 10 });
    expect(byContentType.rows.map((r) => r.title)).toEqual(["Published Course"]);
  });

  it("cannot be overridden by a caller-supplied status filter", async () => {
    const category = await makeFoodAcademyCategory();
    await makeFoodAcademyEntry({ title: "Real Published", categoryId: category.id });
    await makeFoodAcademyEntry({ title: "Sneaky Draft", categoryId: category.id, status: "Draft" });

    const result = await findPublishedFoodAcademyEntries({
      where: { status: "Draft" } as never,
      skip: 0,
      take: 10,
    });
    expect(result.rows.map((r) => r.title)).toEqual(["Real Published"]);
  });
});

describe("findFeaturedFoodAcademyEntries", () => {
  it("only returns featured, Published entries", async () => {
    const category = await makeFoodAcademyCategory();
    await makeFoodAcademyEntry({ title: "Featured Published", categoryId: category.id, isFeatured: true });
    await makeFoodAcademyEntry({ title: "Featured Draft", categoryId: category.id, isFeatured: true, status: "Draft" });
    await makeFoodAcademyEntry({ title: "Not Featured", categoryId: category.id, isFeatured: false });

    const featured = await findFeaturedFoodAcademyEntries(10);
    expect(featured.map((e) => e.title)).toEqual(["Featured Published"]);
  });
});

describe("findPublishedFoodAcademyEntryBySlug", () => {
  it("returns null for a missing or Draft slug", async () => {
    const category = await makeFoodAcademyCategory();
    await makeFoodAcademyEntry({ slug: "draft-entry", categoryId: category.id, status: "Draft" });
    expect(await findPublishedFoodAcademyEntryBySlug("draft-entry")).toBeNull();
    expect(await findPublishedFoodAcademyEntryBySlug("does-not-exist")).toBeNull();
  });

  it("returns sections in order and raw recipe/product ids", async () => {
    const category = await makeFoodAcademyCategory();
    const recipeCategory = await makeCategory();
    const recipe = await makeRecipe(recipeCategory.id);
    const product = await createProduct({ sku: "SKU-FA-1", slug: "curry-powder-fa", name: "Curry Powder" });

    await makeFoodAcademyEntry({
      slug: "knife-course",
      categoryId: category.id,
      contentType: "Course",
      recipeIds: [recipe.id],
      productIds: [product.id],
      sections: [
        { sectionNumber: 2, title: "Second", bodyContent: "..." },
        { sectionNumber: 1, title: "First", bodyContent: "..." },
        { sectionNumber: 3, title: "Third", bodyContent: "..." },
      ],
    });

    const result = await findPublishedFoodAcademyEntryBySlug("knife-course");
    expect(result?.sections.map((s) => s.title)).toEqual(["First", "Second", "Third"]);
    expect(result?.recipeRefs.map((r) => r.recipeId)).toEqual([recipe.id]);
    expect(result?.productRefs.map((r) => r.productId)).toEqual([product.id]);
  });
});

describe("findRelatedFoodAcademyEntries", () => {
  it("excludes the entry itself and only returns Published entries sharing the category", async () => {
    const category = await makeFoodAcademyCategory();
    const target = await makeFoodAcademyEntry({ slug: "target", categoryId: category.id });
    await makeFoodAcademyEntry({ slug: "same-category", categoryId: category.id });
    await makeFoodAcademyEntry({ slug: "draft-same-category", categoryId: category.id, status: "Draft" });
    const otherCategory = await makeFoodAcademyCategory();
    await makeFoodAcademyEntry({ slug: "other-category", categoryId: otherCategory.id });

    const related = await findRelatedFoodAcademyEntries({ id: target.id, categoryId: category.id }, 6);
    expect(related.map((r) => r.slug)).toEqual(["same-category"]);
  });
});

describe("findActiveFoodAcademyCategories", () => {
  it("returns Active categories, sorted by sortOrder", async () => {
    await makeFoodAcademyCategory({ name: "B" });
    await makeFoodAcademyCategory({ name: "A" });
    await prisma.foodAcademyCategory.create({ data: { name: "Inactive", slug: "inactive-cat", status: "Inactive" } });

    const categories = await findActiveFoodAcademyCategories();
    expect(categories.map((c) => c.name)).toEqual(["B", "A"]);
  });
});

describe("findRecipesByIds (recipe.repository.ts)", () => {
  it("only returns Published recipes matching the given ids", async () => {
    const recipeCategory = await makeCategory();
    const published = await makeRecipe(recipeCategory.id, { title: "Published Recipe" });
    const draft = await makeRecipe(recipeCategory.id, { title: "Draft Recipe", status: "Draft" });

    const results = await findRecipesByIds([published.id, draft.id], 10);
    expect(results.map((r) => r.title)).toEqual(["Published Recipe"]);
  });
});
