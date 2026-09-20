import { expect, test } from "@playwright/test";

test("searching a known product by exact name shows it in results", async ({ page }) => {
  await page.goto("/products/search?q=Roasted+Curry+Powder");

  await expect(page.getByRole("heading", { level: 1, name: /Results for/ })).toBeVisible();
  await expect(page.getByText("Roasted Curry Powder 100g")).toBeVisible();
});

test("a common misspelling surfaces a did-you-mean suggestion, and the corrected link works", async ({ page }) => {
  // NOTE: a typo of a *product* name (e.g. "chili powder" for "Chilli
  // Powder 100g") does NOT reach the did-you-mean branch here: the ranked
  // product-match tier-2 threshold (`similarity(p.name, query) > 0.3` in
  // findRankedProductMatches) is identical to the did-you-mean threshold
  // (`similarity(name, query) > 0.3` in findClosestNameSuggestion), so any
  // query close enough to suggest a product name already matches that
  // product directly via the normal results path — the did-you-mean
  // branch (`items.length === 0`) never renders for that case. It's only
  // reachable via a typo of a *category* name (categories are never part
  // of the ranked-match tiers beyond a literal substring check), which is
  // what this test exercises instead. See task-13-report.md for the
  // verification behind this.
  await page.goto("/products/search?q=curyy+powderr");

  const didYouMean = page.getByRole("link", { name: /Spices & Curry Powders/ });
  await expect(didYouMean).toBeVisible();

  await didYouMean.click();

  await expect(page).toHaveURL(/q=Spices(%20|\+)%26(%20|\+)Curry(%20|\+)Powders/);
  await expect(page.getByText("Chilli Powder 100g")).toBeVisible();
});

test("applying a STORY-010 filter on top of search results keeps the query in the URL", async ({ page }) => {
  await page.goto("/products/search?q=curry");
  await expect(page.getByText(/Curry/).first()).toBeVisible();

  await page.getByRole("checkbox", { name: /In Stock/i }).click();

  await expect(page).toHaveURL(/q=curry/);
  await expect(page).toHaveURL(/inStock=true/);
});

test("search results page is not indexable", async ({ page }) => {
  const response = await page.goto("/products/search?q=curry");
  const html = await response!.text();

  expect(html).toContain('name="robots"');
  expect(html).toMatch(/noindex/);
});
