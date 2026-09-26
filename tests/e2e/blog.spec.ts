import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// The storefront's global PageTransition (src/components/motion/page-transition.tsx)
// fades every route in via Framer Motion (opacity 0 -> 1 over 300ms), keyed
// on pathname so it restarts on every navigation. Scanning with axe while
// that fade is mid-flight produces false-positive color-contrast violations
// (the effective, still-partially-transparent text color against the page
// background). Waiting out the transition's documented duration before each
// axe scan avoids that without touching the shared component. (Mirrors
// tests/e2e/food-academy.spec.ts's local helper of the same name — that
// helper isn't exported, so it's duplicated here rather than imported.)
const PAGE_TRANSITION_MS = 300;
async function waitForPageTransition(page: import("@playwright/test").Page): Promise<void> {
  await page.waitForTimeout(PAGE_TRANSITION_MS + 200);
}

// Depends on prisma/seed-blog.ts. 11 seeded posts total: 10 Published, 1
// Draft ("How Oristor Selects Its Growers", never appears). Of the 10
// Published, 1 is published far into the future ("Our Plans for Next Year's
// Product Lineup", publishedAt 2099-01-01) and must not appear/must 404 like
// a not-yet-live post. That leaves 9 Published + past-dated posts, which is
// below the hub's fixed pageSize of 12 (src/validation/blog.schema.ts;
// src/app/(storefront)/blog/page.tsx deliberately never reads a `pageSize`
// query param — see the identical "pageSize is API-only" comments in
// src/lib/recipe-listing-params.ts / product-listing-params.ts), so
// pagination controls never render for this seed's real counts; that is
// itself real, verified behaviour and is asserted below rather than faked
// by seeding extra posts.
//
// "how-to-make-restaurant-style-chicken-curry-at-home" contains a working
// [[recipe:sri-lankan-chicken-curry]] embed and a working
// [[video:https://www.youtube.com/watch?v=dQw4w9WgXcQ]] embed.
// "a-beginners-guide-to-tempering-spices" contains an unresolvable
// [[recipe:this-slug-does-not-exist]] embed.

const DRAFT_TITLE = "How Oristor Selects Its Growers";
const FUTURE_TITLE = "Our Plans for Next Year's Product Lineup";
const FUTURE_SLUG = "our-plans-for-next-years-product-lineup";

test("/blog lists Published, past-dated posts only; the Draft and future-scheduled titles never appear", async ({ page }) => {
  const response = await page.request.get("/blog");
  const html = await response.text();

  expect(response.status()).toBe(200);
  // Not "9 posts" via a raw-HTML .toContain() here: React SSR splits
  // `{result.total} post{...}s` into adjacent text nodes separated by
  // `<!-- -->` hydration-boundary comments in the raw HTML, so the literal
  // string "9 posts" never appears in `response.text()` even though it
  // renders correctly. `getByText` reads the browser's normalized text
  // content instead, which collapses those comment nodes away.
  await page.goto("/blog");
  await expect(page.getByText("9 posts", { exact: true })).toBeVisible();
  expect(html).toContain("The Story Behind Our Roasted Curry Powder");
  expect(html).toContain("Five Spices Every Sri Lankan Kitchen Needs");
  expect(html).toContain("How to Make Restaurant-Style Chicken Curry at Home");
  expect(html).toContain("A Brief History of the Ceylon Spice Trade");
  expect(html).toContain("Understanding the Health Benefits of Turmeric");
  expect(html).toContain("Seasonal Cooking: What to Make During Avurudu");
  expect(html).toContain("Our Approach to Sustainable Spice Sourcing");
  expect(html).toContain("A Beginner's Guide to Tempering Spices");
  expect(html).toContain("Everything You Need to Know About Jaggery");
  expect(html).not.toContain(DRAFT_TITLE);
  expect(html).not.toContain(FUTURE_TITLE);
});

test("clicking a tag chip filters via navigation and updates the URL", async ({ page }) => {
  await page.goto("/blog");

  const tagNav = page.getByRole("navigation", { name: "Filter by tag" });
  await tagNav.getByRole("link", { name: "Spices", exact: true }).click();

  await expect(page).toHaveURL(/\/blog\?tag=spices$/);
  await expect(tagNav.getByRole("link", { name: "Spices", exact: true })).toHaveAttribute("aria-current", "page");

  await expect(page.getByRole("heading", { level: 3, name: "The Story Behind Our Roasted Curry Powder" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Understanding the Health Benefits of Turmeric" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Our Approach to Sustainable Spice Sourcing" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Five Spices Every Sri Lankan Kitchen Needs" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "A Brief History of the Ceylon Spice Trade" })).toHaveCount(0);
});

test("clicking an author chip filters via navigation and updates the URL", async ({ page }) => {
  await page.goto("/blog");

  const authorNav = page.getByRole("navigation", { name: "Filter by author" });
  await authorNav.getByRole("link", { name: "Amara Perera", exact: true }).click();

  await expect(page).toHaveURL(/\/blog\?author=amara-perera$/);
  await expect(authorNav.getByRole("link", { name: "Amara Perera", exact: true })).toHaveAttribute("aria-current", "page");

  await expect(page.getByRole("heading", { level: 3, name: "The Story Behind Our Roasted Curry Powder" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Our Approach to Sustainable Spice Sourcing" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Five Spices Every Sri Lankan Kitchen Needs" })).toHaveCount(0);
});

test("clicking a different tag chip while an author filter is active preserves the author filter", async ({ page }) => {
  // Kamal de Silva's Published/past posts: "A Brief History of the Ceylon
  // Spice Trade" (sri-lankan-cuisine, brand-stories), "Understanding the
  // Health Benefits of Turmeric" (health, spices), and "Everything You Need
  // to Know About Jaggery" (health, sri-lankan-cuisine).
  await page.goto("/blog?tag=health&author=kamal-de-silva");

  await expect(page.getByText("2 posts", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Understanding the Health Benefits of Turmeric" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Everything You Need to Know About Jaggery" })).toBeVisible();

  const tagNav = page.getByRole("navigation", { name: "Filter by tag" });
  await tagNav.getByRole("link", { name: "Spices", exact: true }).click();

  // This exact bug class (a chip click clobbering the other active filter)
  // was found and fixed in Task 7 (src/lib/blog-chip-href.ts,
  // buildBlogChipHref) — the author param must survive this navigation.
  await expect(page).toHaveURL(/\/blog\?tag=spices&author=kamal-de-silva$/);
  await expect(page.getByRole("heading", { level: 3, name: "Understanding the Health Benefits of Turmeric" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Everything You Need to Know About Jaggery" })).toHaveCount(0);
});

test("clicking a different author chip while a tag filter is active preserves the tag filter", async ({ page }) => {
  await page.goto("/blog?tag=spices&author=kamal-de-silva");

  await expect(page.getByRole("heading", { level: 3, name: "Understanding the Health Benefits of Turmeric" })).toBeVisible();

  const authorNav = page.getByRole("navigation", { name: "Filter by author" });
  await authorNav.getByRole("link", { name: "Nadeesha Fernando", exact: true }).click();

  await expect(page).toHaveURL(/\/blog\?tag=spices&author=nadeesha-fernando$/);
  await expect(page.getByRole("heading", { level: 3, name: "Five Spices Every Sri Lankan Kitchen Needs" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Understanding the Health Benefits of Turmeric" })).toHaveCount(0);
});

test("clicking 'All tags' clears only the tag filter and preserves the author filter", async ({ page }) => {
  await page.goto("/blog?tag=spices&author=kamal-de-silva");

  const tagNav = page.getByRole("navigation", { name: "Filter by tag" });
  await tagNav.getByRole("link", { name: "All tags", exact: true }).click();

  await expect(page).toHaveURL(/\/blog\?author=kamal-de-silva$/);
  await expect(page.getByRole("heading", { level: 3, name: "Understanding the Health Benefits of Turmeric" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Everything You Need to Know About Jaggery" })).toBeVisible();
});

test("pagination controls do not render when every post fits on one page, and an out-of-range page navigates without crashing", async ({ page }) => {
  // 9 real Published + past-dated posts (see header note) is below the
  // hub's fixed pageSize of 12, so BlogPagination (which returns null
  // whenever Math.ceil(total / pageSize) <= 1) correctly renders nothing
  // here. Component-level pagination rendering/href-building for larger
  // counts is covered by tests/unit/blog-pagination.test.tsx.
  await page.goto("/blog");
  await expect(page.getByRole("navigation", { name: "Blog pagination" })).toHaveCount(0);

  const response = await page.request.get("/blog?page=2");
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain("No posts match that filter.");
});

test("a post with [[recipe:...]] and [[video:...]] embeds shows a real recipe card link and a real video poster, not literal token text", async ({ page }) => {
  await page.goto("/blog/how-to-make-restaurant-style-chicken-curry-at-home");

  const bodyText = await page.locator("body").innerText();
  expect(bodyText).not.toContain("[[recipe:");
  expect(bodyText).not.toContain("[[video:");

  const recipeLink = page.locator('a[href="/recipes/sri-lankan-chicken-curry"]').first();
  await expect(recipeLink).toBeVisible();

  await expect(page.getByRole("button", { name: "Play video" })).toBeVisible();
});

test("a post with an unresolvable [[recipe:...]] embed renders without crashing and without broken/literal token text", async ({ page }) => {
  const response = await page.goto("/blog/a-beginners-guide-to-tempering-spices");
  expect(response?.status()).toBe(200);

  await expect(page.getByRole("heading", { level: 1, name: "A Beginner's Guide to Tempering Spices" })).toBeVisible();
  const bodyText = await page.locator("body").innerText();
  expect(bodyText).not.toContain("[[recipe:");
  expect(bodyText).not.toContain("this-slug-does-not-exist");
  await expect(page.getByText(/Mustard seeds go in first/)).toBeVisible();
});

test("submitting a comment shows the awaiting-approval message, and the just-submitted comment does not appear after reload", async ({ page }) => {
  await page.goto("/blog/five-spices-every-sri-lankan-kitchen-needs");

  const commentBody = `E2E test comment ${Date.now()}`;
  await page.getByLabel("Name").fill("E2E Tester");
  await page.getByLabel("Email").fill(`e2e.${Date.now()}@example.com`);
  await page.getByLabel("Comment").fill(commentBody);
  await page.getByRole("button", { name: "Submit comment" }).click();

  await expect(page.getByText("Thanks — your comment is awaiting approval.")).toBeVisible();

  await page.reload();
  await expect(page.getByText(commentBody)).toHaveCount(0);
});

test("returns 404 for a nonexistent post slug and for the future-scheduled post's real slug", async ({ page }) => {
  expect((await page.request.get("/blog/this-slug-does-not-exist-at-all")).status()).toBe(404);
  expect((await page.request.get(`/blog/${FUTURE_SLUG}`)).status()).toBe(404);
});

test("Blog hub page has no automatically detectable accessibility violations", async ({ page }) => {
  await page.goto("/blog");
  await waitForPageTransition(page);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("the recipe/video embed post detail page has no automatically detectable accessibility violations", async ({ page }) => {
  await page.goto("/blog/how-to-make-restaurant-style-chicken-curry-at-home");
  await waitForPageTransition(page);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("the unresolvable-embed post detail page has no automatically detectable accessibility violations", async ({ page }) => {
  await page.goto("/blog/a-beginners-guide-to-tempering-spices");
  await waitForPageTransition(page);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
