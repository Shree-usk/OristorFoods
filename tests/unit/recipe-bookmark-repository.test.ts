// tests/unit/recipe-bookmark-repository.test.ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  addBookmark,
  findExistingBookmarkedRecipeIds,
  isBookmarked,
  listBookmarkedRecipeIdsForCustomer,
  removeBookmark,
} from "@/repositories/recipe-bookmark.repository";
import { createRecipe, createRecipeCategory } from "@/repositories/recipe.repository";
import { computeTotalTimeMinutes } from "@/lib/recipe-time";

let sequence = 0;

async function makeRecipe(status: "Published" | "Draft" = "Published") {
  sequence += 1;
  const category = await createRecipeCategory({ name: `Category ${sequence}`, slug: `rb-repo-category-${sequence}` });
  return createRecipe({
    slug: `rb-repo-recipe-${sequence}`,
    title: `Recipe ${sequence}`,
    shortDescription: "A test recipe.",
    heroImage: "/images/products/export/curry-powder.webp",
    heroImageAlt: "Test hero image",
    categoryId: category.id,
    difficulty: "Easy",
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    totalTimeMinutes: computeTotalTimeMinutes(10, 20),
    servings: 4,
    status,
  });
}

async function makeUser() {
  sequence += 1;
  return prisma.user.create({ data: { email: `rb-repo-${sequence}@test.com`, name: "Bookmark Tester" } });
}

afterEach(async () => {
  await prisma.recipeBookmark.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.recipeCategory.deleteMany();
});

describe("addBookmark / isBookmarked / removeBookmark", () => {
  it("creates a bookmark and reports it as bookmarked", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();

    await addBookmark(recipe.id, user.id);

    expect(await isBookmarked(recipe.id, user.id)).toBe(true);
  });

  it("enforces one bookmark per (recipe, customer) at the database level", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    await addBookmark(recipe.id, user.id);

    await expect(addBookmark(recipe.id, user.id)).rejects.toThrow();
  });

  it("removeBookmark on an already-removed row is a no-op, not a throw", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();

    await expect(removeBookmark(recipe.id, user.id)).resolves.not.toThrow();
    expect(await isBookmarked(recipe.id, user.id)).toBe(false);
  });

  it("removeBookmark actually removes an existing row", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    await addBookmark(recipe.id, user.id);

    await removeBookmark(recipe.id, user.id);

    expect(await isBookmarked(recipe.id, user.id)).toBe(false);
  });
});

describe("listBookmarkedRecipeIdsForCustomer", () => {
  it("only returns bookmarks for Published recipes, most recent first", async () => {
    const user = await makeUser();
    const published = await makeRecipe("Published");
    const draft = await makeRecipe("Draft");
    await addBookmark(draft.id, user.id);
    await addBookmark(published.id, user.id);

    expect(await listBookmarkedRecipeIdsForCustomer(user.id)).toEqual([published.id]);
  });
});

describe("findExistingBookmarkedRecipeIds", () => {
  it("returns only the ids that are already bookmarked", async () => {
    const user = await makeUser();
    const bookmarked = await makeRecipe();
    const notBookmarked = await makeRecipe();
    await addBookmark(bookmarked.id, user.id);

    const existing = await findExistingBookmarkedRecipeIds(user.id, [bookmarked.id, notBookmarked.id]);
    expect(existing).toEqual([bookmarked.id]);
  });
});
