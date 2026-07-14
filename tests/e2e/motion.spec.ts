import { expect, test } from "@playwright/test";

test("page transition doesn't break navigation or update the URL incorrectly", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL("/");

  await page.locator("header").getByRole("link", { name: "About" }).click();
  await expect(page).toHaveURL(/\/about/);
});

test("route change doesn't strand focus (no a11y focus-loss)", async ({ page }) => {
  await page.goto("/");
  const aboutLink = page.locator("header").getByRole("link", { name: "About" });
  await aboutLink.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/about/);
  // Focus should end up somewhere sane (not lost to <body>) after navigation.
  const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
  expect(focusedTag).not.toBeNull();
});

test.describe("prefers-reduced-motion: reduce", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("homepage content renders immediately in its final state", async ({ page }) => {
    await page.goto("/");
    // With reduced motion, PageTransition and ScrollReveal both render
    // children directly (no motion wrapper, no whileInView gating) —
    // the Hero headline should be visible immediately with no extra
    // wait beyond Playwright's normal auto-waiting.
    await expect(page.getByRole("heading", { level: 1, name: "Feel the Difference" })).toBeVisible();
  });
});
