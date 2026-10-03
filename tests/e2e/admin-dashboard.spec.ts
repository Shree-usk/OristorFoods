import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import type { AdminModule } from "@/generated/prisma/client";

const EMAIL_DOMAIN = "@e2e-admin-dashboard.test";
const ROLE_KEY_PREFIX = "e2e-admin-dashboard-role-";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

const ALL_WIDGET_MODULES: AdminModule[] = [
  "Orders",
  "Reviews",
  "QA",
  "Products",
  "RewardsReferrals",
  "Customers",
  "ERPIntegration",
  "CRMAnalytics",
  "ExportPortal",
  "UsersRolesAudit",
];

async function makeAdminUser(modules: AdminModule[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `E2E Admin Dashboard Role ${sequence}` } });
  await prisma.rolePermission.createMany({ data: modules.map((module) => ({ roleId: role.id, module, action: "View" })) });
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

test.describe("Admin Dashboard (STORY-039)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  });

  test("a Super Administrator-equivalent role sees every real widget plus both remaining placeholders", async ({ page }) => {
    const admin = await makeAdminUser(ALL_WIDGET_MODULES);
    await signIn(page, admin.email);

    await expect(page.getByText("Today's Revenue & Orders", { exact: true })).toBeVisible();
    await expect(page.getByText("Pending Moderation", { exact: true })).toBeVisible();
    await expect(page.getByText("Pending Product Q&A", { exact: true })).toBeVisible();
    await expect(page.getByText("Low Stock Alerts", { exact: true })).toBeVisible();
    await expect(page.getByText("Rewards & Referrals", { exact: true })).toBeVisible();
    await expect(page.getByText("Support Tickets", { exact: true })).toBeVisible();
    await expect(page.getByText("Failed Payments", { exact: true })).toBeVisible();
    await expect(page.getByText("ERP Sync Status", { exact: true })).toBeVisible();
    await expect(page.getByText("Live Visitors", { exact: true })).toBeVisible();
    await expect(page.getByText("Export Enquiries", { exact: true })).toBeVisible();
    await expect(page.getByText("System Health", { exact: true })).toBeVisible();
  });

  test("a role granted only Orders sees a visibly reduced widget set", async ({ page }) => {
    const admin = await makeAdminUser(["Orders"]);
    await signIn(page, admin.email);

    await expect(page.getByText("Today's Revenue & Orders", { exact: true })).toBeVisible();
    await expect(page.getByText("Failed Payments", { exact: true })).toBeVisible();

    await expect(page.getByText("Pending Moderation", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Low Stock Alerts", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Rewards & Referrals", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Support Tickets", { exact: true })).toHaveCount(0);
    await expect(page.getByText("ERP Sync Status", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Live Visitors", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Export Enquiries", { exact: true })).toHaveCount(0);
    await expect(page.getByText("System Health", { exact: true })).toHaveCount(0);
  });

  test("a role with no widget permissions sees the empty-state message, not an error", async ({ page }) => {
    const admin = await makeAdminUser([]);
    await signIn(page, admin.email);

    await expect(page.getByText("Your role has no dashboard widgets to show.")).toBeVisible();
  });
});
