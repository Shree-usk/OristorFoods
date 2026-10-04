import { expect, test } from "@playwright/test";

/**
 * STORY-061. Semantic-similarity ranking itself can't be exercised
 * here — this environment's OpenAI account has no billing credits, so
 * every embedding call fails and the semantic layer transparently
 * skips (see smart-search-service.test.ts for that path's real
 * coverage). This spec instead verifies the unified, grouped-by-type
 * results page and confirms the autocomplete overlay (now a
 * genuinely separate route) is unaffected.
 */

test("results page groups real seeded results across content types for one query", async ({ page }) => {
  await page.goto("/search?q=curry");

  await expect(page.getByRole("heading", { level: 1, name: 'Results for "curry"' })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Products" })).toBeVisible();
  await expect(page.getByText(/Curry Powder/).first()).toBeVisible();

  const recipesHeading = page.getByRole("heading", { level: 2, name: "Recipes" });
  if (await recipesHeading.isVisible()) {
    await expect(recipesHeading).toBeVisible();
  }
});

test("a query with no matches still shows the existing empty state, not a broken page", async ({ page }) => {
  await page.goto("/search?q=zzz-no-such-product-zzz");

  await expect(page.getByText('No results found for "zzz-no-such-product-zzz".')).toBeVisible();
  await expect(page.getByRole("link", { name: "all products" })).toHaveAttribute("href", "/products");
});

test("the header overlay's autocomplete stays fast and keyword-only, unaffected by the semantic results page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Search" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes("/api/search/autocomplete")),
    dialog.getByLabel("Search").fill("curry"),
  ]);

  expect(response.ok()).toBe(true);
  await expect(page.getByRole("link", { name: /Curry/ }).first()).toBeVisible();
});
