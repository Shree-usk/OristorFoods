import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { computeTotalTimeMinutes } from "@/lib/recipe-time";
import { prisma } from "@/lib/db";
import { createRecipe, createRecipeCategory } from "@/repositories/recipe.repository";
import { advanceRecipeReviewToApproved, submitReview } from "@/services/recipe-review.service";

import { signInAs } from "./helpers/auth";

const CATEGORY_SLUG_PREFIX = "e2e-recipe-review-";
const RECIPE_SLUG_PREFIX = "e2e-recipe-review-";
const EMAIL_DOMAIN = "@e2e-recipe-review.test";

async function seedRecipe(n: number, title: string) {
  const category = await createRecipeCategory({ name: `E2E Category ${n}`, slug: `${CATEGORY_SLUG_PREFIX}${n}` });
  return createRecipe({
    slug: `${RECIPE_SLUG_PREFIX}${n}`,
    title,
    shortDescription: "A test recipe for the reviews e2e suite.",
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

async function seedUser(label: string, name: string) {
  return prisma.user.create({ data: { email: `${label}${EMAIL_DOMAIN}`, name } });
}

test.describe("Recipe reviews", () => {
  // Both tests clean up the same slug/email prefixes in beforeEach — same
  // reasoning as product-reviews.spec.ts's own test.describe.configure.
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.recipe.deleteMany({ where: { slug: { startsWith: RECIPE_SLUG_PREFIX } } });
    await prisma.recipeCategory.deleteMany({ where: { slug: { startsWith: CATEGORY_SLUG_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  });

  test("a submitted review stays private until it is approved, then can be edited and withdrawn", async ({ page }) => {
    const recipe = await seedRecipe(1, "E2E Review Curry");
    const user = await seedUser("writer", "Asha W.");
    await signInAs(page, user.id);

    await page.goto(`/recipes/${recipe.slug}`);
    await page.getByRole("radio", { name: "4 stars" }).check({ force: true });
    await page.getByLabel("Your review (optional)").fill("Toasted notes come through nicely.");
    await page.getByRole("button", { name: "Submit review" }).click();
    await expect(page.getByText("Thanks! Your review is pending approval.")).toBeVisible();

    await page.reload();
    const reviews = page.locator('section[aria-labelledby="recipe-reviews-heading"]');
    await expect(reviews.getByText("No reviews yet.")).toBeVisible();

    await page.getByRole("button", { name: "Edit review" }).click();
    await page.getByRole("radio", { name: "5 stars" }).check({ force: true });
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Thanks! Your review is pending approval.")).toBeVisible();

    await page.getByRole("button", { name: "Withdraw" }).click();
    await page.getByRole("button", { name: "Yes, withdraw" }).click();
    await expect(page.getByRole("button", { name: "Submit review" })).toBeVisible();
  });

  test("approved reviews show on the recipe detail page, sorted and paginated", async ({ page }) => {
    const recipe = await seedRecipe(2, "E2E Reviewed Watalappan");
    const authorA = await seedUser("a", "Nimal S.");
    const authorB = await seedUser("b", "Ruwani D.");
    const reviewA = await submitReview(authorA.id, recipe.slug, { rating: 5, reviewText: "Perfectly set." });
    const reviewB = await submitReview(authorB.id, recipe.slug, { rating: 3, reviewText: "A bit too sweet for me." });
    await advanceRecipeReviewToApproved(reviewA.id);
    await advanceRecipeReviewToApproved(reviewB.id);

    await page.goto(`/recipes/${recipe.slug}`);
    const reviews = page.locator('section[aria-labelledby="recipe-reviews-heading"]');
    await expect(reviews.getByText("Showing 1–2 of 2 reviews")).toBeVisible();
    await expect(reviews.getByText("Perfectly set.")).toBeVisible();
    await expect(reviews.getByText("A bit too sweet for me.")).toBeVisible();
    await expect(page.getByRole("img", { name: "Rated 4.0 out of 5 from 2 ratings" })).toBeVisible();

    await reviews.getByRole("combobox", { name: "Sort reviews" }).click();
    await page.getByRole("option", { name: "Lowest rating" }).click();
    const firstReview = reviews.locator("article").first();
    await expect(firstReview).toContainText("A bit too sweet for me.");
  });

  test("an unauthenticated visitor is prompted to sign in, with callbackUrl preserved", async ({ page }) => {
    const recipe = await seedRecipe(3, "E2E Signed-Out Curry");

    await page.goto(`/recipes/${recipe.slug}`);

    const signInLink = page.getByRole("link", { name: "Sign in to write a review" });
    await expect(signInLink).toHaveAttribute("href", `/account/login?callbackUrl=%2Frecipes%2F${recipe.slug}`);
  });

  test("the review form's star input has no detectable accessibility violations", async ({ page }) => {
    const recipe = await seedRecipe(4, "E2E Accessible Kottu");
    await signInAs(page, (await seedUser("c", "Dilani K.")).id);

    await page.goto(`/recipes/${recipe.slug}`);
    await expect(page.getByRole("button", { name: "Submit review" })).toBeVisible();

    const results = await new AxeBuilder({ page }).include('section[aria-labelledby="recipe-reviews-heading"]').analyze();
    expect(results.violations).toEqual([]);
  });
});
