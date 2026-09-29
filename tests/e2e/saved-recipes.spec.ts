import { expect, test } from "@playwright/test";

import { computeTotalTimeMinutes } from "@/lib/recipe-time";
import { prisma } from "@/lib/db";
import { createRecipe, createRecipeCategory } from "@/repositories/recipe.repository";

import { signInAs } from "./helpers/auth";

const CATEGORY_SLUG_PREFIX = "e2e-saved-recipes-";
const RECIPE_SLUG_PREFIX = "e2e-saved-recipes-";
const EMAIL_DOMAIN = "@e2e-saved-recipes.test";

async function seedRecipe(n: number, title: string) {
  const category = await createRecipeCategory({ name: `E2E Saved Recipes Category ${n}`, slug: `${CATEGORY_SLUG_PREFIX}${n}` });
  return createRecipe({
    slug: `${RECIPE_SLUG_PREFIX}${n}`,
    title,
    shortDescription: "A test recipe for the saved-recipes e2e suite.",
    heroImage: "/images/products/export/curry-powder.webp",
    heroImageAlt: "Test hero image",
    categoryId: category.id,
    difficulty: "Easy",
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    totalTimeMinutes: computeTotalTimeMinutes(10, 20),
    servings: 4,
    status: "Published",
    publishedAt: new Date(),
  });
}

async function seedUser(label: string, name: string) {
  return prisma.user.create({ data: { email: `${label}${EMAIL_DOMAIN}`, name } });
}

test.describe("Saved Recipes & Sync (STORY-037)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.recipeBookmark.deleteMany({ where: { customer: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.recipe.deleteMany({ where: { slug: { startsWith: RECIPE_SLUG_PREFIX } } });
    await prisma.recipeCategory.deleteMany({ where: { slug: { startsWith: CATEGORY_SLUG_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  });

  test("shows an empty state with no bookmarked recipes", async ({ page }) => {
    const user = await seedUser("empty", "Empty Test");
    await signInAs(page, user.id);

    await page.goto("/account/saved-recipes");
    await expect(page.getByText("You haven't saved any recipes yet")).toBeVisible();
  });

  test("a recipe bookmarked on its detail page appears on the saved-recipes page and dashboard count, then unsaving syncs both back", async ({ page }) => {
    const recipe = await seedRecipe(1, "E2E Saved Chicken Curry");
    const user = await seedUser("sync", "Sync Test");
    await signInAs(page, user.id);

    await page.goto(`/recipes/${recipe.slug}`);
    await page.getByRole("button", { name: "Bookmark this recipe" }).click();
    await expect(page.getByRole("button", { name: "Remove bookmark" })).toBeVisible();

    await page.goto("/account/saved-recipes");
    await expect(page.getByText(recipe.title)).toBeVisible();

    await page.goto("/account");
    await expect(page.getByText("1 saved recipe")).toBeVisible();

    await page.goto("/account/saved-recipes");
    await page.getByRole("button", { name: "Remove bookmark" }).click();
    await expect(page.getByText("You haven't saved any recipes yet")).toBeVisible();

    // Real DB persistence, not just client cache: a fresh navigation to the
    // detail page must also show it unbookmarked.
    await page.goto(`/recipes/${recipe.slug}`);
    await expect(page.getByRole("button", { name: "Bookmark this recipe" })).toBeVisible();
  });

  test("filters saved recipes by category", async ({ page }) => {
    const curry = await seedRecipe(2, "E2E Filter Curry");
    const dessert = await seedRecipe(3, "E2E Filter Dessert");
    const user = await seedUser("filter", "Filter Test");
    await signInAs(page, user.id);

    for (const recipe of [curry, dessert]) {
      await page.goto(`/recipes/${recipe.slug}`);
      await page.getByRole("button", { name: "Bookmark this recipe" }).click();
      await expect(page.getByRole("button", { name: "Remove bookmark" })).toBeVisible();
    }

    await page.goto("/account/saved-recipes");
    await expect(page.getByText(curry.title)).toBeVisible();
    await expect(page.getByText(dessert.title)).toBeVisible();

    await page.getByLabel("Filter by category").click();
    await page.getByRole("option", { name: "E2E Saved Recipes Category 2" }).click();

    await expect(page.getByText(curry.title)).toBeVisible();
    await expect(page.getByText(dessert.title)).not.toBeVisible();
  });
});
