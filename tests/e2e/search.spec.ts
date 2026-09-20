import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("opens the overlay from the header, shows suggestions, and navigates to results", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Search" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Scoped to the dialog: an unscoped page.getByLabel("Search") is ambiguous
  // here — it also matches the header's "Search" dialog-trigger button,
  // which remains in the DOM (just visually behind the overlay) while open.
  await dialog.getByLabel("Search").fill("curry");
  await expect(page.getByRole("link", { name: /Curry/ }).first()).toBeVisible();

  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/search\?q=curry/);
  await expect(page.getByRole("heading", { level: 1, name: 'Results for "curry"' })).toBeVisible();
});

test("closes the overlay on Escape and returns focus to the trigger", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Search" });

  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("mobile nav's Search item links directly to a usable results page", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  await page.locator('nav[aria-label="Primary"]').getByRole("link", { name: "Search" }).click();

  await expect(page).toHaveURL("/search");
  // Scoped to <main>: the header's "Search" dialog-trigger button is also
  // present in the DOM at this viewport (hidden via a "hidden lg:flex"
  // ancestor, not unmounted), so an unscoped page.getByLabel("Search")
  // matches both it and the page's own search input.
  await page.locator("main").getByLabel("Search").fill("chilli");
  await page.getByRole("button", { name: "Search", exact: true }).click();

  await expect(page).toHaveURL(/\/search\?q=chilli/);
  await expect(page.getByText(/Chilli Powder/).first()).toBeVisible();
});

test("shows a no-results empty state with links to browse instead", async ({ page }) => {
  await page.goto("/search?q=zzz-no-such-product-zzz");

  await expect(page.getByText('No results found for "zzz-no-such-product-zzz".')).toBeVisible();
  await expect(page.getByRole("link", { name: "all products" })).toHaveAttribute("href", "/products");
});

test("search overlay has zero critical/serious axe violations when open", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  const results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  const critical = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
});

test("search results page has zero critical/serious axe violations", async ({ page }) => {
  await page.goto("/search?q=curry");

  const results = await new AxeBuilder({ page }).analyze();
  const critical = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
});
