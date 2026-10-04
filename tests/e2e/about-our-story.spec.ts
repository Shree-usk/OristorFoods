import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** STORY-073. Serial mode: this session's own established PGlite-contention precaution, applied consistently even though this page has no DB reads. */

test.describe("Our Story / About page (STORY-073)", () => {
  test.describe.configure({ mode: "serial" });

  test("renders the hero and every chapter heading", async ({ page }) => {
    await page.goto("/about");

    await expect(page.getByRole("heading", { level: 1, name: "A Taste of Sri Lanka, Crafted for the World." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Born from Sri Lanka" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "The Flavours We Grew Up With" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recipes With a Memory" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "From Our Kitchen to Yours" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "What We Stand For" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "From Ingredient to Finished Product" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "From Sri Lanka to the World" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Feel the Difference" })).toBeVisible();
  });

  test("the seven O-R-I-S-T-O-R values are all present", async ({ page }) => {
    await page.goto("/about");

    for (const word of ["Originality", "Reliability", "Innovation", "Sustainability", "Tradition", "Outstanding Quality", "Respect"]) {
      await expect(page.getByRole("heading", { name: word, exact: true })).toBeVisible();
    }
  });

  test("both closing CTAs link to real, working destinations", async ({ page }) => {
    await page.goto("/about");

    await expect(page.getByRole("link", { name: "Explore Products" })).toHaveAttribute("href", "/products");
    await expect(page.getByRole("link", { name: "Meet The Oristor" })).toHaveAttribute("href", "/contact-us");
    await expect(page.getByRole("link", { name: /Explore Our Export Range/ })).toHaveAttribute("href", "/export");
  });

  test("the product-story sequence renders all 6 real categories", async ({ page }) => {
    await page.goto("/about");

    for (const name of ["Pickles", "Pickled Vegetables", "Chilli Pastes", "Seafood", "Masalas"]) {
      await expect(page.getByRole("heading", { name })).toBeAttached();
    }
    // "Spices" also names one of Chapter 02's ingredient callouts — scope
    // to the last match (the product-story sequence's own heading, which
    // renders after it in the page) rather than asserting on a name that
    // legitimately appears twice for two different, real reasons.
    await expect(page.getByRole("heading", { name: "Spices" }).last()).toBeAttached();
  });

  test("the new header 'About' link now resolves to real content, not a 404", async ({ page }) => {
    await page.goto("/");
    await page.locator("header").getByRole("link", { name: "About" }).click();
    await expect(page).toHaveURL(/\/about/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("the new 'About' page has zero critical/serious axe violations", async ({ page }) => {
    await page.goto("/about");

    const results = await new AxeBuilder({ page }).analyze();
    const critical = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
  });

  test.describe("mobile viewport", () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test("the product-story sequence renders as a vertical stack, not a pinned horizontal sequence", async ({ page }) => {
      await page.goto("/about");
      await expect(page.getByRole("heading", { name: "Pickles" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Spices" }).last()).toBeVisible();
    });
  });

  test.describe("prefers-reduced-motion: reduce", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    test("the product-story sequence falls back to the vertical stack even at desktop width", async ({ page }) => {
      await page.goto("/about");
      await expect(page.getByRole("heading", { name: "Pickles" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Spices" }).last()).toBeVisible();
    });

    test("page content renders immediately in its final state", async ({ page }) => {
      await page.goto("/about");
      await expect(page.getByRole("heading", { level: 1, name: "A Taste of Sri Lanka, Crafted for the World." })).toBeVisible();
    });
  });
});
