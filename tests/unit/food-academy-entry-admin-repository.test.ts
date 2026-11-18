// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { makeRecipe, makeCategory as makeRecipeCategory } from "./recipe-fixtures";
import {
  createFoodAcademyEntryAdmin,
  deleteFoodAcademyEntryById,
  findFoodAcademyEntryAdminDetailById,
  listFeaturedFoodAcademyEntryIdsForAdmin,
  listFoodAcademyEntriesForAdmin,
  reorderFoodAcademyEntries,
  toggleFoodAcademyEntryFeatured,
  updateFoodAcademyEntryAdmin,
  updateFoodAcademyEntryStatus,
  type FoodAcademyEntryAdminWriteInput,
} from "@/repositories/food-academy.repository";
import { cleanupRecipes, makeFoodAcademyCategory, makeFoodAcademyEntry } from "./recipe-fixtures";

afterEach(async () => {
  await cleanupRecipes();
  await prisma.product.deleteMany();
});

function baseInput(categoryId: string, overrides: Partial<FoodAcademyEntryAdminWriteInput> = {}): FoodAcademyEntryAdminWriteInput {
  return {
    slug: `fa-admin-entry-${Math.random().toString(36).slice(2)}`,
    title: "Test Entry",
    summary: "A test summary.",
    heroImageUrl: null,
    contentType: "Article",
    categoryId,
    bodyContent: "Body content.",
    readingTimeMinutes: 5,
    authorName: "Test Author",
    isFeatured: false,
    sections: [],
    recipeIds: [],
    productIds: [],
    ...overrides,
  };
}

describe("createFoodAcademyEntryAdmin / updateFoodAcademyEntryAdmin", () => {
  it("creates an entry with sections and recipe/product cross-links", async () => {
    const category = await makeFoodAcademyCategory();
    const recipeCategory = await makeRecipeCategory();
    const recipe = await makeRecipe(recipeCategory.id);
    const product = await createProduct({ sku: "SKU-FA-ADMIN-1", slug: "fa-admin-product-1", name: "Test Product" });

    const created = await createFoodAcademyEntryAdmin(
      baseInput(category.id, {
        contentType: "Course",
        recipeIds: [recipe.id],
        productIds: [product.id],
        sections: [
          { sectionNumber: 1, title: "First", bodyContent: "..." },
          { sectionNumber: 2, title: "Second", bodyContent: "..." },
        ],
      }),
    );

    expect(created.sections.map((s) => s.title)).toEqual(["First", "Second"]);
    expect(created.recipeRefs.map((r) => r.recipeId)).toEqual([recipe.id]);
    expect(created.productRefs.map((r) => r.productId)).toEqual([product.id]);
    expect(created.status).toBe("Draft");
    expect(created.sortOrder).toBe(0);
  });

  it("update fully replaces sections and cross-links, never merges", async () => {
    const category = await makeFoodAcademyCategory();
    const recipeCategory = await makeRecipeCategory();
    const recipeA = await makeRecipe(recipeCategory.id);
    const recipeB = await makeRecipe(recipeCategory.id);

    const created = await createFoodAcademyEntryAdmin(
      baseInput(category.id, {
        recipeIds: [recipeA.id],
        sections: [{ sectionNumber: 1, title: "Original", bodyContent: "..." }],
      }),
    );

    const updated = await updateFoodAcademyEntryAdmin(
      created.id,
      baseInput(category.id, {
        slug: created.slug,
        recipeIds: [recipeB.id],
        sections: [{ sectionNumber: 1, title: "Replaced", bodyContent: "..." }],
      }),
    );

    expect(updated.sections.map((s) => s.title)).toEqual(["Replaced"]);
    expect(updated.recipeRefs.map((r) => r.recipeId)).toEqual([recipeB.id]);
  });
});

describe("deleteFoodAcademyEntryById", () => {
  it("removes the entry row", async () => {
    const category = await makeFoodAcademyCategory();
    const created = await createFoodAcademyEntryAdmin(baseInput(category.id));
    await deleteFoodAcademyEntryById(created.id);
    expect(await findFoodAcademyEntryAdminDetailById(created.id)).toBeNull();
  });
});

describe("updateFoodAcademyEntryStatus", () => {
  it("transitions status and sets/clears publishedAt", async () => {
    const category = await makeFoodAcademyCategory();
    const created = await createFoodAcademyEntryAdmin(baseInput(category.id));
    expect(created.status).toBe("Draft");

    const publishedAt = new Date("2026-09-01T00:00:00Z");
    const published = await updateFoodAcademyEntryStatus(created.id, { status: "Published", publishedAt });
    expect(published.status).toBe("Published");
    expect(published.publishedAt?.toISOString()).toBe(publishedAt.toISOString());

    const unpublished = await updateFoodAcademyEntryStatus(created.id, { status: "Draft", publishedAt: null });
    expect(unpublished.status).toBe("Draft");
    expect(unpublished.publishedAt).toBeNull();
  });
});

describe("toggleFoodAcademyEntryFeatured", () => {
  it("flips isFeatured", async () => {
    const category = await makeFoodAcademyCategory();
    const created = await createFoodAcademyEntryAdmin(baseInput(category.id, { isFeatured: false }));
    const toggled = await toggleFoodAcademyEntryFeatured(created.id, true);
    expect(toggled.isFeatured).toBe(true);
  });
});

describe("listFoodAcademyEntriesForAdmin", () => {
  it("includes every status and filters by status/categoryId/search", async () => {
    const category = await makeFoodAcademyCategory();
    const otherCategory = await makeFoodAcademyCategory();
    await makeFoodAcademyEntry({ title: "Draft Entry", categoryId: category.id, status: "Draft" });
    await makeFoodAcademyEntry({ title: "Published Entry", categoryId: category.id, status: "Published" });
    await makeFoodAcademyEntry({ title: "Other Category Entry", categoryId: otherCategory.id });

    const all = await listFoodAcademyEntriesForAdmin({}, 1, 50);
    expect(all.total).toBeGreaterThanOrEqual(3);

    const draftsOnly = await listFoodAcademyEntriesForAdmin({ status: "Draft" }, 1, 50);
    expect(draftsOnly.items.every((e) => e.status === "Draft")).toBe(true);

    const byCategory = await listFoodAcademyEntriesForAdmin({ categoryId: category.id }, 1, 50);
    expect(byCategory.items.map((e) => e.title).sort()).toEqual(["Draft Entry", "Published Entry"]);

    const bySearch = await listFoodAcademyEntriesForAdmin({ search: "Other Category" }, 1, 50);
    expect(bySearch.items.map((e) => e.title)).toEqual(["Other Category Entry"]);
  });
});

describe("reorderFoodAcademyEntries / listFeaturedFoodAcademyEntryIdsForAdmin", () => {
  it("only reorders entries that are currently featured, and lists exactly those ids", async () => {
    const category = await makeFoodAcademyCategory();
    const featuredA = await makeFoodAcademyEntry({ categoryId: category.id, isFeatured: true });
    const featuredB = await makeFoodAcademyEntry({ categoryId: category.id, isFeatured: true });
    const notFeatured = await makeFoodAcademyEntry({ categoryId: category.id, isFeatured: false });

    const featuredIds = await listFeaturedFoodAcademyEntryIdsForAdmin();
    expect(new Set(featuredIds)).toEqual(new Set([featuredA.id, featuredB.id]));

    await reorderFoodAcademyEntries([featuredB.id, featuredA.id, notFeatured.id]);

    const rows = await prisma.foodAcademyEntry.findMany({
      where: { id: { in: [featuredA.id, featuredB.id, notFeatured.id] } },
      select: { id: true, sortOrder: true },
    });
    const sortOrderById = new Map(rows.map((r) => [r.id, r.sortOrder]));
    expect(sortOrderById.get(featuredB.id)).toBe(0);
    expect(sortOrderById.get(featuredA.id)).toBe(1);
    // notFeatured wasn't touched because the repository's updateMany is scoped to isFeatured:true.
    expect(sortOrderById.get(notFeatured.id)).toBe(0);
  });
});
