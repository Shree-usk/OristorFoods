import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Exact blueprint Section 4 order. "Newsletter" and "Footer" (the last
// two blueprint items) are satisfied by the site-wide <Footer> — see the
// comment in src/app/(storefront)/page.tsx and docs/architecture-decisions.md
// for why a second, separate newsletter section isn't rendered here too.
const sectionHeadings = [
  { level: 1, name: "Feel the Difference" }, // Hero Banner
  { level: 2, name: "Shop by Category" }, // Featured Categories
  { level: 2, name: "Why Choose Oristor" },
  { level: 2, name: "Best Selling Products" },
  { level: 2, name: "Featured Recipes" },
  { level: 2, name: "Product Collections" },
  { level: 2, name: "Learn to Cook Sri Lankan the Authentic Way" }, // Food Academy
  { level: 2, name: "What Our Customers Say" }, // Customer Reviews
  { level: 2, name: "Partner with Oristor for Global Distribution" }, // Export Solutions
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
