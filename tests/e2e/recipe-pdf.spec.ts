import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/db";
import { computeTotalTimeMinutes } from "@/lib/recipe-time";
import { createRecipe, createRecipeCategory } from "@/repositories/recipe.repository";

const CATEGORY_SLUG_PREFIX = "e2e-recipe-pdf-";
const RECIPE_SLUG_PREFIX = "e2e-recipe-pdf-";

test.describe("Recipe PDF download", () => {
  test.beforeEach(async () => {
    await prisma.recipe.deleteMany({ where: { slug: { startsWith: RECIPE_SLUG_PREFIX } } });
    await prisma.recipeCategory.deleteMany({ where: { slug: { startsWith: CATEGORY_SLUG_PREFIX } } });
  });

  test("downloading a recipe's PDF returns a valid application/pdf response", async ({ page }) => {
    const category = await createRecipeCategory({ name: "E2E PDF Category", slug: `${CATEGORY_SLUG_PREFIX}1` });
    const recipe = await createRecipe({
      slug: `${RECIPE_SLUG_PREFIX}1`,
      title: "E2E PDF Curry",
      shortDescription: "A test recipe for the PDF e2e suite.",
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

    await page.goto(`/recipes/${recipe.slug}`);
    const downloadLink = page.getByRole("link", { name: `Download ${recipe.title} recipe card as a PDF` });
    await expect(downloadLink).toHaveAttribute("href", `/api/recipes/${recipe.slug}/pdf`);

    const response = await page.request.get(`/api/recipes/${recipe.slug}/pdf`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("application/pdf");
    const body = await response.body();
    expect(body.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
