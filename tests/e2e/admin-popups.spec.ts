import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";

const EMAIL_DOMAIN = "@e2e-admin-popups.test";
const ROLE_KEY_PREFIX = "e2e-admin-popups-role-";
const NAME_PREFIX = "E2E Popup ";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeAdminUser(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `E2E Admin Popups Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "E2E Admin", passwordHash, roleId: role.id } });
}

async function signInAdmin(page: import("@playwright/test").Page, email: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe("Admin Promotional Pop-up Manager (STORY-050a)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.popupInteraction.deleteMany({ where: { popup: { name: { startsWith: NAME_PREFIX } } } });
    await prisma.promotionalPopup.deleteMany({ where: { name: { startsWith: NAME_PREFIX } } });
    await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  });

  test("a View/Edit-only admin cannot publish; a full-access admin creates, publishes, and the popup renders and is recorded on the real homepage", async ({ page, browser }) => {
    test.setTimeout(120_000);

    const editor = await makeAdminUser([
      { module: "Marketing", action: "View" },
      { module: "Marketing", action: "Edit" },
    ]);
    const admin = await makeAdminUser([
      { module: "Marketing", action: "View" },
      { module: "Marketing", action: "Edit" },
      { module: "Marketing", action: "Approve" },
    ]);

    sequence += 1;
    const popupName = `${NAME_PREFIX}${sequence}`;
    const popupTitle = `E2E Test Popup Title ${sequence}`;

    await signInAdmin(page, admin.email);
    await page.goto("/admin/marketing/popups/new");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Internal name").fill(popupName);
    await page.getByLabel("Title", { exact: true }).fill(popupTitle);
    await page.getByLabel("CTA label", { exact: true }).fill("Shop now");
    await page.getByLabel("CTA link", { exact: true }).fill("/products");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    // "new" itself would also match a bare [a-z0-9]+ pattern — require the cuid's leading "c" to exclude it.
    await expect(page).toHaveURL(/\/admin\/marketing\/popups\/c[a-z0-9]+$/, { timeout: 15_000 });

    const popupId = page.url().split("/").pop()!;

    // The View/Edit-only admin cannot publish — server-side 403, not just a hidden button.
    const editorContext = await browser.newContext();
    const editorPage = await editorContext.newPage();
    await signInAdmin(editorPage, editor.email);
    const deniedResponse = await editorContext.request.post(`/api/admin/marketing/popups/${popupId}/status`, {
      headers: { "Content-Type": "application/json" },
      data: { status: "Published" },
    });
    expect(deniedResponse.status()).toBe(403);
    await editorContext.close();

    // The full-access admin publishes successfully.
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("Published", { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    // A real, separate storefront visitor sees it on the homepage.
    const visitorContext = await browser.newContext();
    const visitorPage = await visitorContext.newPage();
    await visitorPage.goto("/");
    await visitorPage.waitForLoadState("networkidle");
    await expect(visitorPage.getByText(popupTitle)).toBeVisible({ timeout: 15_000 });

    const impression = await prisma.popupInteraction.findFirst({ where: { popupId, type: "Impression" } });
    expect(impression).not.toBeNull();

    // Dismiss it, then reload — OncePerSession (the default) must not show it again this session.
    await visitorPage.getByRole("button", { name: "Close" }).click();
    await expect(visitorPage.getByText(popupTitle)).not.toBeVisible({ timeout: 5_000 });
    await visitorPage.reload();
    await visitorPage.waitForLoadState("networkidle");
    await expect(visitorPage.getByText(popupTitle)).not.toBeVisible({ timeout: 5_000 });

    const dismissal = await prisma.popupInteraction.findFirst({ where: { popupId, type: "Dismissal" } });
    expect(dismissal).not.toBeNull();

    await visitorContext.close();
  });
});
