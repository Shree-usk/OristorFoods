import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// The storefront's global PageTransition (src/components/motion/page-transition.tsx)
// fades every route in via Framer Motion (opacity 0 -> 1 over 300ms), keyed
// on pathname so it restarts on every navigation. Scanning with axe while
// that fade is mid-flight produces false-positive color-contrast violations
// (the effective, still-partially-transparent text color against the page
// background). Waiting out the transition's documented duration before each
// axe scan avoids that without touching the shared component.
const PAGE_TRANSITION_MS = 300;
async function waitForPageTransition(page: import("@playwright/test").Page): Promise<void> {
  await page.waitForTimeout(PAGE_TRANSITION_MS + 200);
}

// Depends on prisma/seed-food-academy.ts: "Understanding Sri Lankan Curry
// Powder" (Article, category "ingredients", featured) and "Tempering
// (Tadka): A Complete Guide" (Guide, category "techniques", featured) are
// Published and featured. "Mastering the Art of Roasted Curry Powder"
// (Course, category "spice-guide") is Published, not featured, has a null
// `bodyContent` (its content lives entirely in its four sections) and links
// to the real seeded recipe sri-lankan-chicken-curry and the real seeded
// product roasted-curry-powder-100g. "The Role of Jaggery in Sri Lankan
// Sweets" (Article, category "ingredients") is Published. "The History of
// Avurudu Food Traditions" is Draft and must never appear.

test("lists Published Food Academy entries only; the Draft entry's title never appears", async ({ page }) => {
  const response = await page.request.get("/food-academy");
  const html = await response.text();

  expect(response.status()).toBe(200);
  expect(html).toContain("Understanding Sri Lankan Curry Powder");
  expect(html).not.toContain("The History of Avurudu Food Traditions");
});

test("the hub page shows a featured row of the featured entries", async ({ page }) => {
  await page.goto("/food-academy");

  const featuredGrid = page.locator("div.xl\\:grid-cols-4");
  await expect(featuredGrid.getByRole("heading", { level: 3, name: "Understanding Sri Lankan Curry Powder" })).toBeVisible();
  await expect(featuredGrid.getByRole("heading", { level: 3, name: "Tempering (Tadka): A Complete Guide" })).toBeVisible();
});

test("clicking a category chip filters via navigation and updates the URL", async ({ page }) => {
  await page.goto("/food-academy");

  const nav = page.getByRole("navigation", { name: "Filter by category" });
  await nav.getByRole("link", { name: "Ingredients", exact: true }).click();

  await expect(page).toHaveURL(/\/food-academy\?category=ingredients$/);
  await expect(nav.getByRole("link", { name: "Ingredients", exact: true })).toHaveAttribute("aria-current", "page");

  await expect(page.getByRole("heading", { level: 3, name: "Understanding Sri Lankan Curry Powder" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "The Role of Jaggery in Sri Lankan Sweets" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Mastering the Art of Roasted Curry Powder" })).toHaveCount(0);
});

test("clicking a content-type chip filters via navigation and updates the URL", async ({ page }) => {
  await page.goto("/food-academy");

  const nav = page.getByRole("navigation", { name: "Filter by content type" });
  await nav.getByRole("link", { name: "Course", exact: true }).click();

  await expect(page).toHaveURL(/\/food-academy\?contentType=Course$/);
  await expect(nav.getByRole("link", { name: "Course", exact: true })).toHaveAttribute("aria-current", "page");

  await expect(page.getByRole("heading", { level: 3, name: "Mastering the Art of Roasted Curry Powder" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Understanding Sri Lankan Curry Powder" })).toHaveCount(0);
});

test("an Article/Guide detail page shows its body content", async ({ page }) => {
  await page.goto("/food-academy/understanding-sri-lankan-curry-powder");

  await expect(page.getByRole("heading", { level: 1, name: "Understanding Sri Lankan Curry Powder" })).toBeVisible();
  await expect(page.getByText(/dry-roasted in a pan before they're ever ground/)).toBeVisible();
  await expect(page.getByText("Coriander seeds")).toBeVisible();
});

test("the Course detail page shows its section nav and every section's content, with no empty intro block", async ({ page }) => {
  await page.goto("/food-academy/mastering-the-art-of-roasted-curry-powder");

  await expect(page.getByRole("heading", { level: 1, name: "Mastering the Art of Roasted Curry Powder" })).toBeVisible();

  // bodyContent is seeded as null for this Course entry — the optional intro
  // block (rendered only when entry.bodyContent is truthy) must not appear.
  await expect(page.locator("div.mt-6.max-w-2xl")).toHaveCount(0);

  const sectionNav = page.getByRole("navigation", { name: "Course sections" });
  const sectionTitles = [
    "A Short History of Sri Lankan Curry Powder",
    "Selecting and Balancing Your Spices",
    "The Roasting Technique",
    "Grinding, Storing and Putting It to Use",
  ];
  for (const title of sectionTitles) {
    await expect(sectionNav.getByRole("link", { name: title })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
  }

  await expect(page.getByText(/Roast each spice separately in a dry pan/)).toBeVisible();
  await expect(page.getByText(/Try your first batch in the Sri Lankan Chicken Curry recipe/)).toBeVisible();
});

test("a Course section nav link is keyboard-operable and navigates to its section hash", async ({ page }) => {
  await page.goto("/food-academy/mastering-the-art-of-roasted-curry-powder");

  const sectionNav = page.getByRole("navigation", { name: "Course sections" });
  const link = sectionNav.getByRole("link", { name: "The Roasting Technique" });

  await link.focus();
  await expect(link).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/#section-3$/);
  await expect(page.getByRole("heading", { level: 2, name: "The Roasting Technique" })).toBeVisible();
});

test("a related-recipe link on the Course page lands on the recipe detail page", async ({ page }) => {
  await page.goto("/food-academy/mastering-the-art-of-roasted-curry-powder");

  const recipeLink = page.locator('a[href="/recipes/sri-lankan-chicken-curry"]').first();
  await expect(recipeLink).toBeVisible();
  await recipeLink.click();

  await expect(page).toHaveURL(/\/recipes\/sri-lankan-chicken-curry$/, { timeout: 20_000 });
});

test("a related-product link on the Course page lands on the product detail page", async ({ page }) => {
  await page.goto("/food-academy/mastering-the-art-of-roasted-curry-powder");

  const productLink = page.locator('a[href="/products/roasted-curry-powder-100g"]').first();
  await expect(productLink).toBeVisible();
  await productLink.click();

  await expect(page).toHaveURL(/\/products\/roasted-curry-powder-100g$/, { timeout: 20_000 });
});

test("returns 404 for a nonexistent or draft Food Academy slug, and 200 for a published one", async ({ page }) => {
  expect((await page.request.get("/food-academy/does-not-exist")).status()).toBe(404);
  expect((await page.request.get("/food-academy/the-history-of-avurudu-food-traditions")).status()).toBe(404);
  expect((await page.request.get("/food-academy/understanding-sri-lankan-curry-powder")).status()).toBe(200);
});

test("Food Academy hub page has no automatically detectable accessibility violations", async ({ page }) => {
  await page.goto("/food-academy");
  await waitForPageTransition(page);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("Article/Guide detail page has no automatically detectable accessibility violations", async ({ page }) => {
  await page.goto("/food-academy/understanding-sri-lankan-curry-powder");
  await waitForPageTransition(page);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("Course detail page has no automatically detectable accessibility violations", async ({ page }) => {
  await page.goto("/food-academy/mastering-the-art-of-roasted-curry-powder");
  await waitForPageTransition(page);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
