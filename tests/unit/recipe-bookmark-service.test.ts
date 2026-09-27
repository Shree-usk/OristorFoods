// tests/unit/recipe-bookmark-service.test.ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createRecipe, createRecipeCategory } from "@/repositories/recipe.repository";
import { computeTotalTimeMinutes } from "@/lib/recipe-time";
import { addBookmark, listBookmarksForCustomer, mergeGuestBookmarks, removeBookmark } from "@/services/recipe-bookmark.service";
import { RecipeNotFoundError } from "@/services/recipe-bookmark.errors";

let sequence = 0;

async function makeRecipe(status: "Published" | "Draft" = "Published") {
  sequence += 1;
  const category = await createRecipeCategory({ name: `Category ${sequence}`, slug: `rb-svc-category-${sequence}` });
  return createRecipe({
    slug: `rb-svc-recipe-${sequence}`,
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
  return prisma.user.create({ data: { email: `rb-svc-${sequence}@test.com`, name: "Bookmark Tester" } });
}

afterEach(async () => {
  await prisma.recipeBookmark.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.recipeCategory.deleteMany();
});

describe("addBookmark / removeBookmark", () => {
  it("adds a bookmark for a Published recipe", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();

    await addBookmark(user.id, recipe.slug);

    const bookmarks = await listBookmarksForCustomer(user.id);
    expect(bookmarks.map((r) => r.id)).toEqual([recipe.id]);
  });

  it("rejects bookmarking a Draft recipe", async () => {
    const recipe = await makeRecipe("Draft");
    const user = await makeUser();

    await expect(addBookmark(user.id, recipe.slug)).rejects.toThrow(RecipeNotFoundError);
  });

  it("a second addBookmark call for the same recipe is an idempotent no-op", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    await addBookmark(user.id, recipe.slug);

    await expect(addBookmark(user.id, recipe.slug)).resolves.toBeUndefined();
    expect(await listBookmarksForCustomer(user.id)).toHaveLength(1);
  });

  it("removeBookmark removes a bookmark", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    await addBookmark(user.id, recipe.slug);

    await removeBookmark(user.id, recipe.slug);

    expect(await listBookmarksForCustomer(user.id)).toEqual([]);
  });
});

describe("mergeGuestBookmarks", () => {
  it("bookmarks every valid, not-yet-bookmarked, Published recipe id", async () => {
    const user = await makeUser();
    const recipeA = await makeRecipe();
    const recipeB = await makeRecipe();
    const draft = await makeRecipe("Draft");

    await mergeGuestBookmarks(user.id, [recipeA.id, recipeB.id, draft.id, "nonexistent-id"]);

    const bookmarks = await listBookmarksForCustomer(user.id);
    expect(bookmarks.map((r) => r.id).sort()).toEqual([recipeA.id, recipeB.id].sort());
  });

  it("skips ids that are already bookmarked", async () => {
    const user = await makeUser();
    const recipe = await makeRecipe();
    await addBookmark(user.id, recipe.slug);

    await expect(mergeGuestBookmarks(user.id, [recipe.id])).resolves.toBeUndefined();
    expect(await listBookmarksForCustomer(user.id)).toHaveLength(1);
  });

  it("is idempotent — calling it twice with the same ids produces no duplicates and no error", async () => {
    const user = await makeUser();
    const recipe = await makeRecipe();

    await mergeGuestBookmarks(user.id, [recipe.id]);
    await mergeGuestBookmarks(user.id, [recipe.id]);

    expect(await listBookmarksForCustomer(user.id)).toHaveLength(1);
  });

  it("does nothing for an empty list", async () => {
    const user = await makeUser();
    await expect(mergeGuestBookmarks(user.id, [])).resolves.toBeUndefined();
  });
});
