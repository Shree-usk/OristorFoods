// tests/unit/recipe-review-repository.test.ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  createReview,
  deleteOwnPendingReview,
  findReviewByRecipeAndCustomer,
  findReviewById,
  listApprovedReviews,
  updateOwnPendingReviewContent,
  updateReviewStatusAndRecalculate,
} from "@/repositories/recipe-review.repository";
import { createRecipe, createRecipeCategory } from "@/repositories/recipe.repository";
import { computeTotalTimeMinutes } from "@/lib/recipe-time";

let sequence = 0;

async function makeCategory() {
  sequence += 1;
  return createRecipeCategory({ name: `Category ${sequence}`, slug: `rr-category-${sequence}` });
}

async function makeRecipe() {
  sequence += 1;
  const category = await makeCategory();
  return createRecipe({
    slug: `rr-recipe-${sequence}`,
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
    status: "Published",
  });
}

async function makeUser(name: string | null = "Test Reviewer") {
  sequence += 1;
  return prisma.user.create({ data: { email: `rr-repo-${sequence}@test.com`, name } });
}

async function makeReview(recipeId: string, rating = 4) {
  const user = await makeUser();
  return createReview({ recipeId, customerId: user.id, rating });
}

afterEach(async () => {
  await prisma.recipeReview.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.recipeCategory.deleteMany();
});

describe("createReview / findReviewById / findReviewByRecipeAndCustomer", () => {
  it("creates a Pending review with no review text by default", async () => {
    const recipe = await makeRecipe();
    const review = await makeReview(recipe.id, 5);

    expect(review.status).toBe("Pending");
    expect(review.reviewText).toBeNull();
    expect(await findReviewById(review.id)).not.toBeNull();
  });

  it("finds a review by (recipeId, customerId)", async () => {
    const recipe = await makeRecipe();
    const review = await makeReview(recipe.id);

    const found = await findReviewByRecipeAndCustomer(recipe.id, review.customerId);
    expect(found?.id).toBe(review.id);
  });

  it("enforces one review per (recipe, customer) at the database level", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    await createReview({ recipeId: recipe.id, customerId: user.id, rating: 4 });

    await expect(createReview({ recipeId: recipe.id, customerId: user.id, rating: 5 })).rejects.toThrow();
  });
});

describe("updateOwnPendingReviewContent / deleteOwnPendingReview", () => {
  it("updates content while still Pending", async () => {
    const recipe = await makeRecipe();
    const review = await makeReview(recipe.id, 3);

    const updated = await updateOwnPendingReviewContent(review.id, review.customerId, { rating: 5, reviewText: "Great!" });
    expect(updated?.rating).toBe(5);
    expect(updated?.reviewText).toBe("Great!");
  });

  it("returns null when the review is no longer Pending (conditional write, not a silent overwrite)", async () => {
    const recipe = await makeRecipe();
    const review = await makeReview(recipe.id);
    await prisma.recipeReview.update({ where: { id: review.id }, data: { status: "Approved" } });

    const updated = await updateOwnPendingReviewContent(review.id, review.customerId, { rating: 1, reviewText: null });
    expect(updated).toBeNull();
    expect((await findReviewById(review.id))?.rating).toBe(review.rating); // untouched
  });

  it("returns null when the customer doesn't own the review", async () => {
    const recipe = await makeRecipe();
    const review = await makeReview(recipe.id);
    const other = await makeUser();

    expect(await updateOwnPendingReviewContent(review.id, other.id, { rating: 1, reviewText: null })).toBeNull();
  });

  it("deletes a Pending review and reports true", async () => {
    const recipe = await makeRecipe();
    const review = await makeReview(recipe.id);

    expect(await deleteOwnPendingReview(review.id, review.customerId)).toBe(true);
    expect(await findReviewById(review.id)).toBeNull();
  });

  it("does not delete (and reports false) a no-longer-Pending review", async () => {
    const recipe = await makeRecipe();
    const review = await makeReview(recipe.id);
    await prisma.recipeReview.update({ where: { id: review.id }, data: { status: "Approved" } });

    expect(await deleteOwnPendingReview(review.id, review.customerId)).toBe(false);
    expect(await findReviewById(review.id)).not.toBeNull();
  });
});

describe("listApprovedReviews", () => {
  it("only returns Approved reviews, sorted and paginated", async () => {
    const recipe = await makeRecipe();
    const pending = await makeReview(recipe.id, 5);
    const approvedLow = await makeReview(recipe.id, 2);
    const approvedHigh = await makeReview(recipe.id, 5);
    await prisma.recipeReview.update({ where: { id: approvedLow.id }, data: { status: "Approved" } });
    await prisma.recipeReview.update({ where: { id: approvedHigh.id }, data: { status: "Approved" } });
    void pending;

    const highest = await listApprovedReviews(recipe.id, { sort: "highest", skip: 0, take: 10 });
    expect(highest.total).toBe(2);
    expect(highest.items.map((r) => r.rating)).toEqual([5, 2]);

    const lowest = await listApprovedReviews(recipe.id, { sort: "lowest", skip: 0, take: 10 });
    expect(lowest.items.map((r) => r.rating)).toEqual([2, 5]);

    const paged = await listApprovedReviews(recipe.id, { sort: "recent", skip: 1, take: 1 });
    expect(paged.items).toHaveLength(1);
    expect(paged.total).toBe(2);
  });
});

describe("updateReviewStatusAndRecalculate", () => {
  it("Pending -> Approved recalculates avgRating/ratingCount from Approved-only reviews", async () => {
    const recipe = await makeRecipe();
    const review = await makeReview(recipe.id, 4);

    const updated = await updateReviewStatusAndRecalculate(review.id, recipe.id, "Pending", { status: "Approved" }, true);
    expect(updated?.status).toBe("Approved");

    const refreshed = await prisma.recipe.findUniqueOrThrow({ where: { id: recipe.id } });
    expect(refreshed.avgRating?.toNumber()).toBe(4);
    expect(refreshed.ratingCount).toBe(1);
  });

  it("Pending -> Rejected does not recalculate (never touches Approved)", async () => {
    const recipe = await makeRecipe();
    const review = await makeReview(recipe.id, 4);

    await updateReviewStatusAndRecalculate(review.id, recipe.id, "Pending", { status: "Rejected" }, false);

    const refreshed = await prisma.recipe.findUniqueOrThrow({ where: { id: recipe.id } });
    expect(refreshed.avgRating).toBeNull();
    expect(refreshed.ratingCount).toBe(0);
  });

  it("Approved -> Hidden recalculates back down to the zero-approved-reviews case (avgRating null, not 0)", async () => {
    const recipe = await makeRecipe();
    const review = await makeReview(recipe.id, 4);
    await updateReviewStatusAndRecalculate(review.id, recipe.id, "Pending", { status: "Approved" }, true);

    await updateReviewStatusAndRecalculate(review.id, recipe.id, "Approved", { status: "Hidden" }, true);

    const refreshed = await prisma.recipe.findUniqueOrThrow({ where: { id: recipe.id } });
    expect(refreshed.avgRating).toBeNull();
    expect(refreshed.ratingCount).toBe(0);
  });

  it("returns null when fromStatus no longer matches (conditional update, not a silent overwrite)", async () => {
    const recipe = await makeRecipe();
    const review = await makeReview(recipe.id, 4);
    await prisma.recipeReview.update({ where: { id: review.id }, data: { status: "Rejected" } });

    const result = await updateReviewStatusAndRecalculate(review.id, recipe.id, "Pending", { status: "Approved" }, true);
    expect(result).toBeNull();
  });

  it(
    "two overlapping approvals against the same recipe both land — no lost update. " +
      "Note: DATABASE_POOL_MAX=1 (PGlite supports one connection) means these two " +
      "$transaction calls physically serialise at the connection-pool level, not at " +
      "the row lock — this still exercises the correctness property that matters " +
      "(each transaction re-aggregates from the DB rather than incrementing a stale " +
      "in-memory count), which is what a lost update would actually break.",
    async () => {
      const recipe = await makeRecipe();
      const reviewA = await makeReview(recipe.id, 3);
      const reviewB = await makeReview(recipe.id, 5);

      await Promise.all([
        updateReviewStatusAndRecalculate(reviewA.id, recipe.id, "Pending", { status: "Approved" }, true),
        updateReviewStatusAndRecalculate(reviewB.id, recipe.id, "Pending", { status: "Approved" }, true),
      ]);

      const refreshed = await prisma.recipe.findUniqueOrThrow({ where: { id: recipe.id } });
      expect(refreshed.ratingCount).toBe(2);
      expect(refreshed.avgRating?.toNumber()).toBe(4);
    },
  );
});
