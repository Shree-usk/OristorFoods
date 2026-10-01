import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";

const EMAIL_DOMAIN = "@e2e-admin-customers.test";
const ROLE_KEY_PREFIX = "e2e-admin-customers-role-";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeAdminUser(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `E2E Admin Customers Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "E2E Admin", passwordHash, roleId: role.id } });
}

async function makeCustomer() {
  sequence += 1;
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  return prisma.user.create({ data: { email: `customer-${sequence}${EMAIL_DOMAIN}`, name: `E2E Customer ${sequence}`, passwordHash, passwordChangedAt: new Date() } });
}

async function signInAdmin(page: import("@playwright/test").Page, email: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe("Admin Customers Console (STORY-048)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.loginEvent.deleteMany({ where: { user: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.coupon.deleteMany({ where: { restrictedToUser: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.rewardTransaction.deleteMany({ where: { user: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.rewardAccount.deleteMany({ where: { user: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  });

  test("suspending a customer blocks their storefront login with a specific message; reactivating restores it", async ({ page, browser }) => {
    test.setTimeout(90_000);

    const admin = await makeAdminUser([
      { module: "Customers", action: "View" },
      { module: "Customers", action: "Edit" },
    ]);
    const customer = await makeCustomer();

    await signInAdmin(page, admin.email);
    await page.goto(`/admin/customers/${customer.id}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: customer.name! })).toBeVisible();

    await page.getByRole("button", { name: "Suspend" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("Reason for suspension").fill("Repeated chargeback fraud.");
    await dialog.getByRole("button", { name: "Suspend", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Suspended", { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    // The suspended customer's own storefront login, in a separate browser context so it never shares cookies/state with the admin page above.
    const customerContext = await browser.newContext();
    const customerPage = await customerContext.newPage();
    await customerPage.goto("/account/login");
    await customerPage.getByLabel("Email address").fill(customer.email!);
    await customerPage.getByLabel("Password").fill(PASSWORD);
    await customerPage.getByRole("button", { name: "Sign in" }).click();
    await expect(customerPage.getByText(/suspended/i)).toBeVisible({ timeout: 15_000 });

    // Reactivate — the same customer can log in again.
    await page.getByRole("button", { name: "Reactivate" }).click();
    await expect(page.getByText("Active", { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    await customerPage.goto("/account/login");
    await customerPage.getByLabel("Email address").fill(customer.email!);
    await customerPage.getByLabel("Password").fill(PASSWORD);
    await customerPage.getByRole("button", { name: "Sign in" }).click();
    await expect(customerPage).toHaveURL("/", { timeout: 15_000 });
    await customerContext.close();
  });

  test("grants reward points reflected in the customer's balance, and issues a coupon restricted to that customer", async ({ page }) => {
    test.setTimeout(90_000);

    const admin = await makeAdminUser([
      { module: "Customers", action: "View" },
      { module: "Customers", action: "Approve" },
    ]);
    const customer = await makeCustomer();

    await signInAdmin(page, admin.email);
    await page.goto(`/admin/customers/${customer.id}`);
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Grant reward points" }).click();
    const rewardDialog = page.getByRole("dialog");
    await rewardDialog.getByLabel("Points").fill("250");
    await rewardDialog.getByLabel("Reason").fill("Service recovery for a delayed order.");
    await rewardDialog.getByRole("button", { name: "Grant", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 15_000 });

    await page.getByRole("tab", { name: "Rewards & Referrals" }).click();
    await expect(page.getByText("Spendable points: 250")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Issue coupon" }).click();
    const couponDialog = page.getByRole("dialog");
    await couponDialog.getByLabel("Expires in (days)").fill("30");
    await couponDialog.getByLabel("Usage limit").fill("1");
    await couponDialog.getByRole("button", { name: "Issue", exact: true }).click();
    await expect(couponDialog.getByText(/^[0-9A-Z]{8}$/)).toBeVisible({ timeout: 15_000 });

    const coupon = await prisma.coupon.findFirstOrThrow({ where: { restrictedToUserId: customer.id } });
    expect(coupon.usageLimitGlobal).toBe(1);
    expect(coupon.usageLimitPerCustomer).toBe(1);
  });
});
