// tests/unit/recipe-review-service.test.ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createRecipe, createRecipeCategory } from "@/repositories/recipe.repository";
import { computeTotalTimeMinutes } from "@/lib/recipe-time";
import {
  advanceRecipeReviewToApproved,
  canTransitionRecipeReview,
  changeRecipeReviewStatus,
  editOwnPendingReview,
  getMyReview,
  listApprovedReviews,
  submitReview,
  withdrawOwnPendingReview,
} from "@/services/recipe-review.service";
import {
  DuplicateRecipeReviewError,
  InvalidRecipeReviewInputError,
  RecipeReviewForbiddenError,
  RecipeReviewNotEditableError,
} from "@/services/recipe-review.errors";

let sequence = 0;

async function makeRecipe(status: "Published" | "Draft" = "Published") {
  sequence += 1;
  const category = await createRecipeCategory({ name: `Category ${sequence}`, slug: `rr-svc-category-${sequence}` });
  return createRecipe({
    slug: `rr-svc-recipe-${sequence}`,
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

async function makeUser(name: string | null = "Test Reviewer") {
  sequence += 1;
  return prisma.user.create({ data: { email: `rr-svc-${sequence}@test.com`, name } });
}

afterEach(async () => {
  await prisma.recipeReview.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.recipeCategory.deleteMany();
});

describe("canTransitionRecipeReview", () => {
  it.each([
    ["Pending", "Approved", true],
    ["Pending", "Rejected", true],
    ["Pending", "Hidden", false],
    ["Approved", "Hidden", true],
    ["Approved", "Pending", false],
    ["Approved", "Rejected", false],
    ["Rejected", "Approved", false],
    ["Hidden", "Approved", false],
  ] as const)("%s -> %s is %s", (from, to, expected) => {
    expect(canTransitionRecipeReview(from, to)).toBe(expected);
  });
});

describe("submitReview / getMyReview", () => {
  it("creates a Pending review", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();

    const review = await submitReview(user.id, recipe.slug, { rating: 5, reviewText: "Loved it" });

    expect(review.status).toBe("Pending");
    expect(await getMyReview(user.id, recipe.slug)).toEqual(review);
  });

  it("rejects a rating outside 1-5 even bypassing the route's own Zod check", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();

    await expect(submitReview(user.id, recipe.slug, { rating: 9 } as never)).rejects.toThrow(InvalidRecipeReviewInputError);
  });

  it("throws DuplicateRecipeReviewError on a second submission for the same recipe", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    await submitReview(user.id, recipe.slug, { rating: 3, reviewText: undefined });

    await expect(submitReview(user.id, recipe.slug, { rating: 4, reviewText: undefined })).rejects.toThrow(DuplicateRecipeReviewError);
  });

  it("throws RecipeNotFoundError for a Draft recipe's slug", async () => {
    const recipe = await makeRecipe("Draft");
    const user = await makeUser();

    await expect(submitReview(user.id, recipe.slug, { rating: 3, reviewText: undefined })).rejects.toThrow("Recipe not found");
  });
});

describe("editOwnPendingReview / withdrawOwnPendingReview", () => {
  it("edits a Pending review's rating and text", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    const review = await submitReview(user.id, recipe.slug, { rating: 2, reviewText: undefined });

    const updated = await editOwnPendingReview(user.id, recipe.slug, review.id, { rating: 5, reviewText: "Changed my mind" });
    expect(updated.rating).toBe(5);
    expect(updated.reviewText).toBe("Changed my mind");
  });

  it("rejects editing another customer's review", async () => {
    const recipe = await makeRecipe();
    const owner = await makeUser();
    const intruder = await makeUser();
    const review = await submitReview(owner.id, recipe.slug, { rating: 2, reviewText: undefined });

    await expect(editOwnPendingReview(intruder.id, recipe.slug, review.id, { rating: 5, reviewText: undefined })).rejects.toThrow(
      RecipeReviewForbiddenError,
    );
  });

  it("rejects editing a review that a moderator already approved", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    const review = await submitReview(user.id, recipe.slug, { rating: 2, reviewText: undefined });
    await advanceRecipeReviewToApproved(review.id);

    await expect(editOwnPendingReview(user.id, recipe.slug, review.id, { rating: 5, reviewText: undefined })).rejects.toThrow(
      RecipeReviewNotEditableError,
    );
  });

  it("withdraws (deletes) a Pending review", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    const review = await submitReview(user.id, recipe.slug, { rating: 2, reviewText: undefined });

    await withdrawOwnPendingReview(user.id, recipe.slug, review.id);

    expect(await getMyReview(user.id, recipe.slug)).toBeNull();
  });
});

describe("changeRecipeReviewStatus / listApprovedReviews", () => {
  it("Approved review appears in the public list and recalculates the recipe's rating", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    const review = await submitReview(user.id, recipe.slug, { rating: 4, reviewText: undefined });

    await advanceRecipeReviewToApproved(review.id);

    const page = await listApprovedReviews(recipe.slug, { page: 1, pageSize: 10, sort: "recent" });
    expect(page.total).toBe(1);
    expect(page.items[0]?.authorName).toBe(user.name);

    const refreshed = await prisma.recipe.findUniqueOrThrow({ where: { id: recipe.id } });
    expect(refreshed.avgRating?.toNumber()).toBe(4);
    expect(refreshed.ratingCount).toBe(1);
  });

  it("a Pending or Rejected review never appears in the public list", async () => {
    const recipe = await makeRecipe();
    const pendingUser = await makeUser();
    const rejectedUser = await makeUser();
    const pending = await submitReview(pendingUser.id, recipe.slug, { rating: 5, reviewText: undefined });
    const rejected = await submitReview(rejectedUser.id, recipe.slug, { rating: 1, reviewText: undefined });
    await changeRecipeReviewStatus(rejected.id, "Rejected");
    void pending;

    const page = await listApprovedReviews(recipe.slug, { page: 1, pageSize: 10, sort: "recent" });
    expect(page.total).toBe(0);
  });

  it("Approved -> Hidden removes it from the public list and recalculates back to null/0", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    const review = await submitReview(user.id, recipe.slug, { rating: 4, reviewText: undefined });
    await advanceRecipeReviewToApproved(review.id);

    await changeRecipeReviewStatus(review.id, "Hidden");

    const page = await listApprovedReviews(recipe.slug, { page: 1, pageSize: 10, sort: "recent" });
    expect(page.total).toBe(0);
    const refreshed = await prisma.recipe.findUniqueOrThrow({ where: { id: recipe.id } });
    expect(refreshed.avgRating).toBeNull();
    expect(refreshed.ratingCount).toBe(0);
  });
});
