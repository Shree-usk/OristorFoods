import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { computeTotalTimeMinutes } from "@/lib/recipe-time";
import { prisma } from "@/lib/db";
import { createRecipe, createRecipeCategory } from "@/repositories/recipe.repository";

import { signInAs } from "./helpers/auth";

const CATEGORY_SLUG_PREFIX = "e2e-recipe-bookmark-";
const RECIPE_SLUG_PREFIX = "e2e-recipe-bookmark-";
const EMAIL_DOMAIN = "@e2e-recipe-bookmark.test";

async function seedRecipe(n: number, title: string) {
  const category = await createRecipeCategory({ name: `E2E Bookmark Category ${n}`, slug: `${CATEGORY_SLUG_PREFIX}${n}` });
  return createRecipe({
    slug: `${RECIPE_SLUG_PREFIX}${n}`,
    title,
    shortDescription: "A test recipe for the bookmarks e2e suite.",
    heroImage: "/images/products/export/curry-powder.webp",
    heroImageAlt: "Test hero image",
    categoryId: category.id,
    difficulty: "Easy",
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    totalTimeMinutes: computeTotalTimeMinutes(10, 20),
    servings: 4,
    status: "Published",
    // /recipes defaults to sort=newest (publishedAt desc, nulls last) — an
    // unset publishedAt would sort this recipe to the very end of the
    // listing, where the "toggling on the recipe card" test's
    // page.goto("/recipes") would never find it.
    publishedAt: new Date(),
  });
}

async function seedUser(label: string, name: string) {
  return prisma.user.create({ data: { email: `${label}${EMAIL_DOMAIN}`, name } });
}

test.describe("Recipe bookmarks", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.recipe.deleteMany({ where: { slug: { startsWith: RECIPE_SLUG_PREFIX } } });
    await prisma.recipeCategory.deleteMany({ where: { slug: { startsWith: CATEGORY_SLUG_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  });

  test("toggling on the detail page is optimistic and persists across reload", async ({ page }) => {
    const recipe = await seedRecipe(1, "E2E Bookmark Chicken Curry");
    const user = await seedUser("a", "Kasun P.");
    await signInAs(page, user.id);

    await page.goto(`/recipes/${recipe.slug}`);
    const button = page.getByRole("button", { name: "Bookmark this recipe" });
    await button.click();
    // Optimistic: the label flips before any network round-trip could have
    // resolved (Playwright's default assertion polling would still pass on
    // a slow non-optimistic implementation, so this specifically does not
    // wait past the click).
    await expect(page.getByRole("button", { name: "Remove bookmark" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("button", { name: "Remove bookmark" })).toBeVisible();
  });

  test("toggling on the recipe card does not navigate to the recipe", async ({ page }) => {
    const recipe = await seedRecipe(2, "E2E Bookmark Watalappan");
    const user = await seedUser("b", "Nadeesha F.");
    await signInAs(page, user.id);

    await page.goto("/recipes");
    const card = page.locator("article", { hasText: recipe.title });
    await card.getByRole("button", { name: "Bookmark this recipe" }).click();

    await expect(card.getByRole("button", { name: "Remove bookmark" })).toBeVisible();
    await expect(page).toHaveURL(/\/recipes$/);
  });

  test("an unauthenticated visitor bookmarking as a guest sees it appear automatically after signing in", async ({ page }) => {
    const recipe = await seedRecipe(3, "E2E Guest Bookmark Dhal");
    const user = await seedUser("c", "Ruwan D.");

    await page.goto(`/recipes/${recipe.slug}`);
    await page.getByRole("button", { name: "Bookmark this recipe" }).click();
    await expect(page.getByRole("button", { name: "Remove bookmark" })).toBeVisible();

    await signInAs(page, user.id);
    await page.reload();

    await expect(page.getByRole("button", { name: "Remove bookmark" })).toBeVisible();
  });

  test("the bookmark toggle has no detectable accessibility violations in either state", async ({ page }) => {
    const recipe = await seedRecipe(4, "E2E Accessible Bookmark Samosas");
    await signInAs(page, (await seedUser("d", "Chamari K.")).id);

    await page.goto(`/recipes/${recipe.slug}`);
    const unbookmarkedResults = await new AxeBuilder({ page })
      .include('button[aria-pressed="false"]')
      .analyze();
    expect(unbookmarkedResults.violations).toEqual([]);

    await page.getByRole("button", { name: "Bookmark this recipe" }).click();
    await expect(page.getByRole("button", { name: "Remove bookmark" })).toBeVisible();
    const bookmarkedResults = await new AxeBuilder({ page }).include('button[aria-pressed="true"]').analyze();
    expect(bookmarkedResults.violations).toEqual([]);
  });
});
