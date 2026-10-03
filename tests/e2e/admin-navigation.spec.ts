import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";

const EMAIL_DOMAIN = "@e2e-admin-navigation.test";
const ROLE_KEY_PREFIX = "e2e-admin-navigation-role-";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeAdminUser(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `E2E Admin Navigation Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "E2E Admin", passwordHash, roleId: role.id } });
}

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/**
 * Deliberately does NOT assert the published menu on a real storefront
 * page load — Header/Footer/Mobile are global, every-page content that
 * other e2e specs (header.spec.ts, footer.spec.ts, search.spec.ts) also
 * assert against under this project's fullyParallel Playwright config, so
 * leaving a published test menu visible for even a few seconds risks
 * flaking those unrelated specs. The publish/rollback atomic-swap
 * behavior and the published-menu-to-NavItem mapping are both already
 * covered at the service layer in tests/unit/navigation-service.test.ts,
 * with zero real HTTP exposure. This spec covers the admin UI itself —
 * the nested drag-and-drop tree, the link checker, and the Publish
 * button's own UI feedback — and cleans up immediately after.
 */
test.describe("Admin Navigation & Menu Management (STORY-052)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.menuItem.deleteMany({});
    await prisma.menu.deleteMany({});
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  });

  test.afterEach(async () => {
    await prisma.menuItem.deleteMany({});
    await prisma.menu.deleteMany({});
  });

  test("adds Header items, reorders them via real keyboard-driven drag, nests a mega-menu section and link, flags a broken link, and publishes", async ({ page }) => {
    test.setTimeout(90_000);

    const admin = await makeAdminUser([
      { module: "Navigation", action: "View" },
      { module: "Navigation", action: "Edit" },
      { module: "Navigation", action: "Delete" },
    ]);

    await signIn(page, admin.email);
    await page.goto("/admin/navigation");
    await page.waitForLoadState("networkidle");

    // Both the tree editor and the live preview pane render the same
    // item labels side by side — scope every assertion to the editor's
    // own landmark region so they don't collide with the preview's copy.
    const editor = page.getByRole("region", { name: "Menu editor" });

    // --- Header tab: add two top-level items ---
    async function addItem(label: string, path: string) {
      await editor.getByRole("button", { name: "Add item" }).first().click();
      await page.getByLabel("Label").fill(label);
      await page.getByLabel("Internal path").fill(path);
      await page.getByRole("button", { name: "Save" }).click();
      await expect(editor.getByText(label, { exact: true })).toBeVisible();
    }

    await addItem("E2E Alpha", "/e2e-nav-alpha");
    await addItem("E2E Beta", "/e2e-nav-beta");

    const rows = editor.locator("li").filter({ hasText: /E2E (Alpha|Beta)/ });
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("E2E Alpha");
    await expect(rows.nth(1)).toContainText("E2E Beta");

    // --- Real drag (keyboard sensor): move Beta above Alpha ---
    const betaHandle = editor.getByRole("button", { name: "Reorder E2E Beta" });
    await betaHandle.focus();
    await page.waitForTimeout(200);
    await page.keyboard.press("Space");
    await page.waitForTimeout(200);
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(200);
    await page.keyboard.press("Space");
    await page.waitForTimeout(200);

    await expect(rows.nth(0)).toContainText("E2E Beta");
    await expect(rows.nth(1)).toContainText("E2E Alpha");

    // --- Mega Menu tab: add a section under E2E Alpha, then a link under that section ---
    await page.getByRole("tab", { name: "Mega Menu" }).click();
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "E2E Alpha" }).click();

    await editor.getByRole("button", { name: "Add item" }).click();
    await page.getByLabel("Label").fill("E2E Shop");
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Grouping only (not clickable)" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(editor.getByText("E2E Shop", { exact: true })).toBeVisible();

    // "E2E Shop" now renders its own nested container with its own "Add
    // item" button for depth-2 children — scope to the <li> containing
    // its label to avoid the sibling root container's own "Add item"
    // button (which would add another top-level section instead).
    await editor.locator("li", { hasText: "E2E Shop" }).getByRole("button", { name: "Add item" }).click();
    await page.getByLabel("Label").fill("E2E All Products");
    await page.getByLabel("Internal path").fill("/e2e-nav-all-products");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(editor.getByText("E2E All Products", { exact: true })).toBeVisible();

    // --- Mobile tab: add an item with a deliberately broken internal path, then run the link checker ---
    await page.getByRole("tab", { name: "Mobile", exact: true }).click();
    await editor.getByRole("button", { name: "Add item" }).click();
    await page.getByLabel("Label").fill("E2E Broken");
    await page.getByLabel("Internal path").fill("/e2e-nav-this-does-not-exist");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(editor.getByText("E2E Broken", { exact: true })).toBeVisible();

    await editor.getByRole("button", { name: "Check links" }).click();
    await expect(editor.getByText(/✗ E2E Broken/)).toBeVisible();

    // --- Publish the Header menu and confirm the admin UI reflects it ---
    await page.getByRole("tab", { name: "Header", exact: true }).click();
    await editor.getByRole("button", { name: "Publish" }).click();
    await expect(editor.getByText("a published version is live")).toBeVisible();
  });
});
