import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Depends on prisma/seed-cooking-tips.ts: "How to Hold a Knife Properly"
// and "Julienne vs Brunoise: Knowing the Difference" are Published with
// topicTag "knife-skills"; "Sharpening Your Knife at Home" is Draft with
// the same topicTag and must never appear. "Tempering Spices in Oil
// (Tadka)" is Published with topicTag "spice-tempering" and links to the
// real seeded product roasted-curry-powder-100g ("Roasted Curry Powder
// 100g"). "Blooming Chilli Powder Without Burning It" is Draft.

test("lists Published cooking tips only; a Draft tip's title never appears", async ({ page }) => {
  const response = await page.request.get("/recipes/cooking-tips");
  const html = await response.text();

  expect(response.status()).toBe(200);
  expect(html).toContain("How to Hold a Knife Properly");
  expect(html).not.toContain("Sharpening Your Knife at Home");
  expect(html).not.toContain("Blooming Chilli Powder Without Burning It");
});

test("clicking a topic chip filters via navigation and updates the URL", async ({ page }) => {
  await page.goto("/recipes/cooking-tips");

  const nav = page.getByRole("navigation", { name: "Filter by topic" });
  await nav.getByRole("link", { name: "knife-skills", exact: true }).click();

  await expect(page).toHaveURL(/\/recipes\/cooking-tips\?topic=knife-skills$/);
  await expect(nav.getByRole("link", { name: "knife-skills", exact: true })).toHaveAttribute("aria-current", "page");

  await expect(page.getByRole("heading", { level: 3, name: "How to Hold a Knife Properly" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Julienne vs Brunoise: Knowing the Difference" })).toBeVisible();
  await expect(page.getByText("Tempering Spices in Oil (Tadka)")).toHaveCount(0);
});

test("a cooking tip detail page shows its body content and a working link to the linked product", async ({ page }) => {
  await page.goto("/recipes/cooking-tips/tempering-spices-in-oil");

  await expect(page.getByRole("heading", { level: 1, name: "Tempering Spices in Oil (Tadka)" })).toBeVisible();
  await expect(page.getByText(/Heat oil until it shimmers/)).toBeVisible();

  const productLink = page.getByRole("link", { name: "Roasted Curry Powder 100g" });
  await expect(productLink).toBeVisible();
  await productLink.click();

  // A generous timeout: on a cold dev server this is the first navigation to
  // /products/[slug], which pays a one-off on-demand compile that can exceed
  // Playwright's default 5s expect timeout.
  await expect(page).toHaveURL(/\/products\/roasted-curry-powder-100g$/, { timeout: 20_000 });
});

test("returns 404 for a nonexistent or draft cooking tip slug, and 200 for a published one", async ({ page }) => {
  expect((await page.request.get("/recipes/cooking-tips/does-not-exist")).status()).toBe(404);
  expect((await page.request.get("/recipes/cooking-tips/sharpening-your-knife-at-home")).status()).toBe(404);
  expect((await page.request.get("/recipes/cooking-tips/tempering-spices-in-oil")).status()).toBe(200);
});

test("cooking tips listing page has no automatically detectable accessibility violations", async ({ page }) => {
  await page.goto("/recipes/cooking-tips");

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("cooking tip detail page has no automatically detectable accessibility violations", async ({ page }) => {
  await page.goto("/recipes/cooking-tips/tempering-spices-in-oil");

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
