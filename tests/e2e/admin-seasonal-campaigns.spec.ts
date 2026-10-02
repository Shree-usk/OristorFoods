import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";

const EMAIL_DOMAIN = "@e2e-admin-seasonal-campaigns.test";
const ROLE_KEY_PREFIX = "e2e-admin-seasonal-campaigns-role-";
const NAME_PREFIX = "E2E Seasonal ";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeAdminUser(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `E2E Admin Seasonal Campaigns Role ${sequence}` } });
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

test.describe("Admin Seasonal Campaign Hub (STORY-050c)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.seasonalCampaign.deleteMany({ where: { name: { startsWith: NAME_PREFIX } } });
    await prisma.popupInteraction.deleteMany({ where: { popup: { name: { startsWith: NAME_PREFIX } } } });
    await prisma.promotionalPopup.deleteMany({ where: { name: { startsWith: NAME_PREFIX } } });
    await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  });

  test("links an existing published popup, walks Draft -> Scheduled -> Active -> Ended, and the performance panel reflects the popup's real interactions", async ({ page, browser }) => {
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
    const popup = await prisma.promotionalPopup.create({
      data: {
        name: `${NAME_PREFIX}Popup ${sequence}`,
        title: `${NAME_PREFIX}Popup Title ${sequence}`,
        status: "Published",
        pageTarget: "AllPages",
        audienceTarget: "AllVisitors",
        triggerType: "Immediate",
        frequencyCap: "OncePerSession",
      },
    });
    await prisma.popupInteraction.createMany({ data: [{ popupId: popup.id, type: "Impression" }, { popupId: popup.id, type: "Impression" }, { popupId: popup.id, type: "Click" }] });

    const campaignName = `${NAME_PREFIX}${sequence}`;

    await signInAdmin(page, admin.email);
    await page.goto("/admin/marketing/seasonal-campaigns/new");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Name", { exact: true }).fill(campaignName);
    await page.getByLabel("Start date").fill("2026-06-01");
    await page.getByLabel("End date").fill("2026-06-30");
    await page.getByRole("combobox", { name: "Popup", exact: true }).click();
    await page.getByRole("option", { name: popup.name }).click();
    await page.getByRole("button", { name: "Create", exact: true }).click();
    // "new" itself would also match a bare [a-z0-9]+ pattern — require the cuid's leading "c" to exclude it.
    await expect(page).toHaveURL(/\/admin\/marketing\/seasonal-campaigns\/c[a-z0-9]+$/, { timeout: 15_000 });

    const campaignId = page.url().split("/").pop()!;
    await expect(page.getByText("Draft", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Impressions: 2")).toBeVisible({ timeout: 15_000 });

    // The View/Edit-only admin cannot approve the Scheduled -> Active move — server-side 403, not just a hidden button.
    const editorContext = await browser.newContext();
    const editorPage = await editorContext.newPage();
    await signInAdmin(editorPage, editor.email);
    await editorContext.request.post(`/api/admin/marketing/seasonal-campaigns/${campaignId}/status`, {
      headers: { "Content-Type": "application/json" },
      data: { status: "Scheduled" },
    });
    const deniedResponse = await editorContext.request.post(`/api/admin/marketing/seasonal-campaigns/${campaignId}/status`, {
      headers: { "Content-Type": "application/json" },
      data: { status: "Active" },
    });
    expect(deniedResponse.status()).toBe(403);
    await editorContext.close();

    // The full-access admin walks the rest of the workflow from the UI.
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Activate" }).click();
    await expect(page.getByText("Active", { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "End campaign" }).click();
    await expect(page.getByText("Ended", { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    const statusLog = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "seasonal_campaign_status_changed", targetId: campaignId } });
    expect(statusLog).not.toBeNull();
  });
});
