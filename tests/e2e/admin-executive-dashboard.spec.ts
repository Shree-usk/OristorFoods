import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";

const EMAIL_DOMAIN = "@e2e-exec-dashboard.test";
const ROLE_KEY_PREFIX = "e2e-exec-dashboard-role-";
const ORDER_PREFIX = "E2E-EXEC-DASH-ORDER-";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeAdminUser(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `E2E Exec Dashboard Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "E2E Exec Dashboard Admin", passwordHash, roleId: role.id } });
}

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function makeOrder(grandTotal: string, createdAt: Date) {
  sequence += 1;
  return prisma.order.create({
    data: {
      orderNumber: `${ORDER_PREFIX}${sequence}`,
      idempotencyKey: `idem-${ORDER_PREFIX}${sequence}`,
      status: "Confirmed",
      subtotal: grandTotal,
      deliveryCharge: "0.00",
      grandTotal,
      deliveryZoneName: "Western",
      shipRecipientName: "Test Customer",
      shipPhone: "+94 77 123 4567",
      shipLine1: "10 Test Lane",
      shipCity: "Colombo",
      createdAt,
    },
  });
}

/** Role keys/order numbers are all namespaced "e2e-exec-dashboard" so this spec's rows never collide with another spec's fixtures under fullyParallel. */
test.describe("Admin Executive Dashboard (STORY-059c)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.order.deleteMany({ where: { orderNumber: { startsWith: ORDER_PREFIX } } });
    await prisma.scheduledReport.deleteMany({ where: { createdBy: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  });

  test.afterEach(async () => {
    await prisma.order.deleteMany({ where: { orderNumber: { startsWith: ORDER_PREFIX } } });
    await prisma.scheduledReport.deleteMany({ where: { createdBy: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  });

  test("loads KPI cards with real period-over-period data, creates a scheduled report, and sends due reports", async ({ page }) => {
    // Raised: processDueScheduledReports awaits a real Ethereal email send, same ~10s external round trip documented for STORY-057's invite flow.
    test.setTimeout(60_000);

    const admin = await makeAdminUser([{ module: "CRMAnalytics", action: "View" }, { module: "CRMAnalytics", action: "Edit" }, { module: "CRMAnalytics", action: "Approve" }]);

    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 13);
    const priorPeriodOrder = new Date(from);
    priorPeriodOrder.setDate(priorPeriodOrder.getDate() - 5);

    await makeOrder("100.00", priorPeriodOrder);
    await makeOrder("300.00", today);

    await signIn(page, admin.email);
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto("/admin/executive-dashboard");
    await page.getByLabel("From").fill(from.toISOString().slice(0, 10));
    await page.getByLabel("To").fill(today.toISOString().slice(0, 10));

    await expect(page.getByText("Revenue", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("300.00").first()).toBeVisible();
    await expect(page.getByText("+200.0% vs. prior period").first()).toBeVisible();
    await expect(page.getByText("Core Web Vitals")).toBeVisible();
    await expect(page.getByText("Not available — no performance tracking exists yet.")).toBeVisible();

    await page.getByRole("button", { name: "New scheduled report" }).click();
    await page.getByRole("combobox", { name: "Report" }).click();
    await page.getByRole("option", { name: "Funnel" }).click();
    await page.getByLabel("Recipients (comma-separated emails)").fill("finance@oristor.test");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("finance@oristor.test")).toBeVisible();
    await expect(page.getByText("Never")).toBeVisible();

    await page.getByRole("button", { name: "Send due reports now" }).click();
    await expect(page.getByText("Never")).not.toBeVisible({ timeout: 30_000 });
  });
});
