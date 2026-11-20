import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Depends on prisma/seed-perfect-match.ts: 4 real confirmed products are
// linked and Published — "Oristor Premium Raw Mango Pickle" is the only
// one with a real local packaging photo and is isDefaultFeatured (so it's
// the initially-selected tab); the other 3 (Muringa Thokku, Red Onion
// Thokku, Seeni Sambol With Maldive Fish) have no image yet and render
// ImagePlaceholder. No PerfectMatchPairing rows are seeded at all yet, so
// every product's pairings grid is absent — see that seed file's own
// comment for why.

async function goToPerfectMatch(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("heading", { name: "Ordinary Meals. Extraordinary Flavours." }).scrollIntoViewIfNeeded();
}

test("the section sits between Export Solutions and Rewards Club", async ({ page }) => {
  await page.goto("/");

  const exportBox = await page.getByRole("heading", { level: 2, name: "Partner with Oristor for Global Distribution" }).boundingBox();
  const perfectMatchBox = await page.getByRole("heading", { level: 2, name: "Ordinary Meals. Extraordinary Flavours." }).boundingBox();
  const rewardsBox = await page.getByRole("heading", { level: 2, name: "Earn Points on Every Order" }).boundingBox();

  expect(exportBox).not.toBeNull();
  expect(perfectMatchBox).not.toBeNull();
  expect(rewardsBox).not.toBeNull();
  expect(perfectMatchBox!.y).toBeGreaterThan(exportBox!.y);
  expect(rewardsBox!.y).toBeGreaterThan(perfectMatchBox!.y);
});

test("the default-featured product (Mango Pickle) is selected initially and shows its real content", async ({ page }) => {
  await goToPerfectMatch(page);

  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveCount(4);
  await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  await expect(tabs.first()).toHaveText(/Mango Pickle/i);

  await expect(page.getByRole("heading", { name: "Oristor Premium Raw Mango Pickle" })).toBeVisible();
  await expect(page.getByText("A bold, tangy favourite")).toBeVisible();
});

test("clicking another tab swaps the featured product without a page reload", async ({ page }) => {
  await goToPerfectMatch(page);

  await page.getByRole("tab", { name: /Seeni Sambol/i }).click();
  await expect(page.getByRole("tab", { name: /Seeni Sambol/i })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Oristor Premium Seeni Sambol With Maldive Fish" })).toBeVisible();
  // No image seeded for this product yet — the placeholder renders instead of a broken image, never a 404.
  await expect(page.getByText("No image available")).toBeVisible();
});

test("ArrowRight moves tab selection and focus", async ({ page }) => {
  await goToPerfectMatch(page);

  const firstTab = page.getByRole("tab").first();
  await firstTab.focus();
  await page.keyboard.press("ArrowRight");

  const secondTab = page.getByRole("tab").nth(1);
  await expect(secondTab).toHaveAttribute("aria-selected", "true");
  await expect(secondTab).toBeFocused();
});

test("'Explore this product' links to the real product page", async ({ page }) => {
  await goToPerfectMatch(page);

  await page.getByRole("button", { name: "Explore this product" }).click();
  await expect(page).toHaveURL(/\/products\/oristor-premium-raw-mango-pickle$/);
  await expect(page.getByRole("heading", { name: "Oristor Premium Raw Mango Pickle", level: 1 })).toBeVisible();
});

test("the product selector has no critical/serious axe violations", async ({ page }) => {
  await goToPerfectMatch(page);
  const results = await new AxeBuilder({ page }).include('[role="tablist"]').analyze();
  const critical = results.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
  expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
});
