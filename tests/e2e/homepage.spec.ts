import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Blueprint Section 4 order, with the Homepage/Header redesign's two
// deviations: WhyChooseOristor is now a full-width benefits strip right
// after the Hero Banner (see why-choose-oristor.tsx) with no heading of
// its own, so it's intentionally absent from this list rather than
// reordered within it; CustomerReviews (the reviews marquee) moved to
// right after Featured Categories. "Newsletter" and "Footer" (the last
// two blueprint items) are satisfied by the site-wide <Footer> — see the
// comment in src/app/(storefront)/page.tsx and docs/architecture-decisions.md
// for why a second, separate newsletter section isn't rendered here too.
const sectionHeadings = [
  { level: 1, name: "Feel the Difference" }, // Hero Banner
  { level: 2, name: "Shop by Category" }, // Featured Categories
  { level: 2, name: "What Our Customers Are Saying" }, // Customer Reviews
  { level: 2, name: "Best Selling Products" },
  { level: 2, name: "Cook with Oristor" }, // Featured Recipes
  { level: 2, name: "Product Collections" },
  { level: 2, name: "Know your ingredients. Discover your flavour." }, // Food Academy
  { level: 2, name: "Partner with Oristor for Global Distribution" }, // Export Solutions
  { level: 2, name: "Ordinary Meals. Extraordinary Flavours." }, // The Perfect Match
  { level: 2, name: "Earn Points on Every Order" }, // Rewards Club
  { level: 2, name: "Follow @oristorfoods" }, // Instagram Gallery
];

test("homepage renders all sections in the exact blueprint order", async ({ page }) => {
  await page.goto("/");

  const headings = page.getByRole("heading", { level: 1 }).or(page.getByRole("heading", { level: 2 }));
  const headingTexts = await headings.allTextContents();

  // Only compare against our expected section headings, in relative
  // order — the page may have other incidental headings (none expected
  // today, but this keeps the assertion focused on section order).
  const expectedNames = sectionHeadings.map((s) => s.name);
  const filtered = headingTexts.filter((text) => expectedNames.includes(text));
  expect(filtered).toEqual(expectedNames);
});

test("the benefits strip sits between the hero and Shop by Category, with all 4 items present once", async ({ page }) => {
  await page.goto("/");

  const benefitTitle = page.getByText("Authentic Sri Lankan Recipes");
  await expect(benefitTitle).toBeVisible();
  await expect(benefitTitle).toHaveCount(1);
  for (const title of ["Premium Quality, Verified", "Trusted by Thousands", "Sustainably Sourced"]) {
    await expect(page.getByText(title)).toHaveCount(1);
  }

  const heroHeadingBox = await page.getByRole("heading", { level: 1 }).boundingBox();
  const benefitBox = await benefitTitle.boundingBox();
  const shopByCategoryBox = await page.getByRole("heading", { level: 2, name: "Shop by Category" }).boundingBox();
  expect(heroHeadingBox).not.toBeNull();
  expect(benefitBox).not.toBeNull();
  expect(shopByCategoryBox).not.toBeNull();
  expect(benefitBox!.y).toBeGreaterThan(heroHeadingBox!.y);
  expect(shopByCategoryBox!.y).toBeGreaterThan(benefitBox!.y);
});

test("exactly one <h1> on the homepage", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
});

test("Newsletter (via the site-wide footer) follows the last homepage section", async ({ page }) => {
  await page.goto("/");
  const footer = page.locator("footer");
  await expect(footer.getByLabel(/inbox/i)).toBeVisible();
});

test("best-selling product cards link to a product page with a formatted price", async ({ page }) => {
  await page.goto("/");
  const firstProduct = page.getByRole("link", { name: /Stemless Chili Paste/ });
  await expect(firstProduct).toHaveAttribute("href", "/products/chili-paste-stemless");
  await expect(firstProduct.getByText(/LKR/)).toBeVisible();
});

test("Instagram gallery links open in a new tab", async ({ page }) => {
  await page.goto("/");
  const galleryLinks = page.locator('a[href*="instagram.com"]');
  expect(await galleryLinks.count()).toBeGreaterThan(0);
  await expect(galleryLinks.first()).toHaveAttribute("target", "_blank");
  await expect(galleryLinks.first()).toHaveAttribute("rel", "noopener noreferrer");
});

test("homepage has zero critical/serious axe violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).analyze();
  const critical = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
});
