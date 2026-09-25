import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Depends on prisma/seed-recipes.ts: sri-lankan-chicken-curry is Published
// (servings 6, first ingredient "3 tbsp Oristor roasted curry powder"
// linked to /products/roasted-curry-powder-100g, plus an unlinked "Salt, to
// taste" ingredient). pumpkin-curry is Draft and milk-toffee is Archived —
// both must 404.

test("navigates from the Recipe Centre to the chicken curry detail page", async ({ page }) => {
  await page.goto("/recipes");
  await page.getByRole("link", { name: "Sri Lankan Chicken Curry" }).click();

  await expect(page).toHaveURL(/\/recipes\/sri-lankan-chicken-curry$/);
  await expect(page.getByRole("heading", { level: 1, name: "Sri Lankan Chicken Curry" })).toBeVisible();
});

test("adjusting servings rescales a linked ingredient's quantity", async ({ page }) => {
  await page.goto("/recipes/sri-lankan-chicken-curry");

  await expect(page.getByText("3 tbsp Oristor roasted curry powder")).toBeVisible();

  await page.getByRole("button", { name: "Increase servings" }).click();

  await expect(page.getByText("3.5 tbsp Oristor roasted curry powder")).toBeVisible();
  await expect(page.getByText("3 tbsp Oristor roasted curry powder")).toHaveCount(0);
});

test("a linked ingredient navigates to its product page; an unlinked ingredient does not", async ({ page }) => {
  await page.goto("/recipes/sri-lankan-chicken-curry");

  const productLink = page.getByRole("link", { name: "3 tbsp Oristor roasted curry powder" });
  await expect(productLink).toBeVisible();
  await productLink.click();
  await expect(page).toHaveURL(/\/products\/roasted-curry-powder-100g$/);

  await page.goBack();
  await expect(page.getByText("Salt, to taste")).toBeVisible();
  await expect(page.getByRole("link", { name: /salt, to taste/i })).toHaveCount(0);
});

test("the Print button triggers window.print without opening a real print dialog", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __printed: boolean }).__printed = false;
    window.print = () => {
      (window as unknown as { __printed: boolean }).__printed = true;
    };
  });

  await page.goto("/recipes/sri-lankan-chicken-curry");
  await page.getByRole("button", { name: "Print", exact: true }).click();

  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __printed: boolean }).__printed))
    .toBe(true);
});

test("related recipes section links to another recipe detail page", async ({ page }) => {
  await page.goto("/recipes/sri-lankan-chicken-curry");

  const section = page.locator("section", { has: page.getByRole("heading", { name: "You might also like" }) });
  await expect(section.getByRole("heading", { name: "You might also like" })).toBeVisible();

  const firstCardLink = section.locator("article a").first();
  await firstCardLink.click();

  await expect(page).toHaveURL(/\/recipes\/[a-z0-9-]+$/);
  await expect(page).not.toHaveURL(/\/recipes\/sri-lankan-chicken-curry$/);
});

test("returns 404 for a nonexistent, draft, or archived recipe slug, and 200 for the published one", async ({ page }) => {
  expect((await page.request.get("/recipes/does-not-exist")).status()).toBe(404);
  expect((await page.request.get("/recipes/pumpkin-curry")).status()).toBe(404);
  expect((await page.request.get("/recipes/milk-toffee")).status()).toBe(404);
  expect((await page.request.get("/recipes/sri-lankan-chicken-curry")).status()).toBe(200);
});

test("recipe detail page has no automatically detectable accessibility violations", async ({ page }) => {
  await page.goto("/recipes/sri-lankan-chicken-curry");

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
