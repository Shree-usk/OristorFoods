import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const desktopPrimaryLabels = [
  "Home",
  "Products",
  "Recipes",
  "Food Academy",
  "Export",
  "Blog",
  "About",
  "Contact",
];
const desktopActionLinkLabels = ["Wishlist", "Rewards", "Sign In", "Cart"];
const mobileLabels = ["Home", "Products", "Recipes", "Search", "Rewards", "Account", "Menu", "Cart"];

test.describe("desktop header", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("shows exactly the 13 blueprint nav items, no more no less", async ({ page }) => {
    await page.goto("/");
    // Scoped to <header> — the footer (STORY-005) links to several of the
    // same labels (Products, Recipes, Blog, Contact, Wishlist...), so an
    // unscoped page-wide lookup would hit strict-mode "multiple elements"
    // errors. Real nav content only, not incidental label collisions.
    const header = page.locator("header");

    for (const label of desktopPrimaryLabels) {
      await expect(
        header.getByRole("link", { name: label, exact: true }).or(
          header.getByRole("button", { name: label, exact: true }),
        ),
      ).toBeVisible();
    }
    for (const label of desktopActionLinkLabels) {
      await expect(header.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    // Search opens the STORY-007 overlay; this smoke test only checks the trigger's presence.
    await expect(header.getByRole("button", { name: "Search", exact: true })).toBeVisible();

    // Mobile-only bottom nav must not render at desktop width.
    await expect(page.locator('nav[aria-label="Primary"]')).toBeHidden();
  });

  test("Home link is marked active on the homepage", async ({ page }) => {
    await page.goto("/");
    const homeLink = page.locator("header").getByRole("link", { name: "Home", exact: true });
    // base-ui's `active` prop sets both a boolean `data-active` attribute
    // (present with an empty string, not the string "true") and the
    // semantically correct `aria-current="page"` — assert the latter.
    await expect(homeLink).toHaveAttribute("aria-current", "page");
  });

  test("Products mega-menu opens on hover and closes on Escape", async ({ page }) => {
    await page.goto("/");
    // The mega-menu popup renders in a portal outside <header> in the DOM
    // (positioned via base-ui's NavigationMenuPositioner), so these two
    // tests intentionally query the whole page, not a header-scoped
    // locator — "All Products"/"All Recipes" don't collide with any
    // footer link text anyway.
    const header = page.locator("header");
    const neutralHoverTarget = header.getByRole("link", { name: "Home", exact: true });
    const productsTrigger = header.getByRole("button", { name: "Products" });
    // base-ui's NavigationMenu uses hover-intent tracking keyed off a
    // fresh pointerenter — re-issuing `.hover()` on an element the mouse
    // is already conceptually "at" doesn't reliably re-fire it. Move away
    // to a neutral element between retries so each attempt is a genuine
    // new hover, not a same-position no-op.
    await expect(async () => {
      await neutralHoverTarget.hover();
      await productsTrigger.hover();
      await expect(productsTrigger).toHaveAttribute("aria-expanded", "true", { timeout: 1500 });
    }).toPass({ timeout: 15_000 });
    const allProductsLink = page.getByRole("link", { name: "All Products" });
    await expect(allProductsLink).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(allProductsLink).toBeHidden();
  });

  test("mega-menu closes when a link inside it is selected", async ({ page }) => {
    await page.goto("/");
    await page.locator("header").getByRole("button", { name: "Recipes" }).click();
    const allRecipesLink = page.getByRole("link", { name: "All Recipes" });
    await expect(allRecipesLink).toBeVisible();
    await allRecipesLink.click();
    await expect(page).toHaveURL(/\/recipes/);
  });

  test("cart and wishlist badges are hidden when count is zero", async ({ page }) => {
    await page.goto("/");
    const header = page.locator("header");
    const cartLink = header.getByRole("link", { name: "Cart", exact: true });
    const wishlistLink = header.getByRole("link", { name: "Wishlist", exact: true });
    await expect(cartLink.locator("span", { hasText: /^\d+$/ })).toHaveCount(0);
    await expect(wishlistLink.locator("span", { hasText: /^\d+$/ })).toHaveCount(0);
  });

  test("header has zero critical/serious axe violations", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page }).include("header").analyze();
    const critical = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
  });
});

test.describe("mobile header/nav", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("bottom nav shows exactly the 8 mobile items", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator('nav[aria-label="Primary"]');
    await expect(nav).toBeVisible();

    for (const label of mobileLabels) {
      await expect(nav.getByText(label, { exact: true })).toBeVisible();
    }

    // Desktop-only nav must not render at mobile width.
    await expect(page.locator('[data-slot="navigation-menu"]')).toBeHidden();
  });

  test("Menu opens the drawer with the desktop-only links, traps focus, and closes on Escape", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Menu" }).click();

    const drawer = page.getByRole("dialog", { name: "Menu" });
    await expect(drawer).toBeVisible();
    for (const label of ["Food Academy", "Export", "Blog", "About", "Contact"]) {
      await expect(drawer.getByRole("link", { name: label })).toBeVisible();
    }
    // Let the open transition + base-ui's initial focus-move settle
    // before driving Tab — starting immediately races the animation and
    // makes the focus-trap assertions below flaky.
    await page.waitForTimeout(450);

    // Focus trap: repeatedly tabbing never lands on real page content
    // outside the dialog. base-ui's trap uses invisible aria-hidden
    // "focus guard" sentinels just outside the dialog boundary to
    // redirect focus back in (the same technique Radix/react-focus-lock
    // use) — a tab stop landing on one of those for a single frame is
    // expected and fine; landing on unrelated, perceivable page content
    // (the nav bar, page body, etc.) would mean the trap is broken.
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      const isTrapped = await page.evaluate(() => {
        const el = document.activeElement;
        const insideDialog = el?.closest('[role="dialog"]') != null;
        const isFocusGuard = el?.hasAttribute("data-base-ui-focus-guard") ?? false;
        return insideDialog || isFocusGuard;
      });
      expect(isTrapped).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  });

  test("drawer closes when a link is selected", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("dialog", { name: "Menu" }).getByRole("link", { name: "About" }).click();
    await expect(page).toHaveURL(/\/about/);
    await expect(page.getByRole("dialog", { name: "Menu" })).toBeHidden();
  });

  test("header has zero critical/serious axe violations", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page }).include('nav[aria-label="Primary"]').analyze();
    const critical = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
  });
});
