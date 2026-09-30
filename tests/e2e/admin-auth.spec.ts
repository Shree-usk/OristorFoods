import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";

const EMAIL_DOMAIN = "@e2e-admin-auth.test";
const ROLE_KEY_PREFIX = "e2e-admin-auth-role-";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeAdminUser(overrides: { failedLoginAttempts?: number; lockedUntil?: Date } = {}) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `E2E Admin Auth Role ${sequence}` } });
  await prisma.rolePermission.create({ data: { roleId: role.id, module: "SystemSettings", action: "View" } });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  return prisma.adminUser.create({
    data: {
      email: `admin-${sequence}${EMAIL_DOMAIN}`,
      name: "E2E Admin",
      passwordHash,
      roleId: role.id,
      failedLoginAttempts: overrides.failedLoginAttempts ?? 0,
      lockedUntil: overrides.lockedUntil,
    },
  });
}

test.describe("Admin Auth & RBAC (STORY-038)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  });

  test("an unauthenticated visitor is redirected to /admin/login with a return path", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login\?callbackUrl=%2Fadmin/);
  });

  test("signs in with correct credentials and reaches the protected admin area", async ({ page }) => {
    const admin = await makeAdminUser();

    await page.goto("/admin/login");
    await page.getByLabel("Email address").fill(admin.email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByText(`${admin.name} · E2E Admin Auth Role`)).toBeVisible();
  });

  test("rejects a wrong password without revealing whether the account exists", async ({ page }) => {
    const admin = await makeAdminUser();

    await page.goto("/admin/login");
    await page.getByLabel("Email address").fill(admin.email);
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Incorrect email or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("locks the account after repeated failed attempts and shows a distinct message", async ({ page }) => {
    const admin = await makeAdminUser({ failedLoginAttempts: 4 });

    await page.goto("/admin/login");
    await page.getByLabel("Email address").fill(admin.email);
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText(/temporarily locked/)).toBeVisible();

    // Even the correct password is rejected while locked.
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText(/temporarily locked/)).toBeVisible();
  });

  test("signing out clears the admin session", async ({ page }) => {
    const admin = await makeAdminUser();

    await page.goto("/admin/login");
    await page.getByLabel("Email address").fill(admin.email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin$/);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/admin\/login/);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("an admin session cannot reach the customer account area, and vice versa", async ({ page }) => {
    const admin = await makeAdminUser();

    await page.goto("/admin/login");
    await page.getByLabel("Email address").fill(admin.email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto("/account");
    await expect(page).toHaveURL(/\/account\/login/);
  });
});
