import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";

const EMAIL_DOMAIN = "@e2e-admin-system-settings.test";
const ROLE_KEY_PREFIX = "e2e-admin-system-settings-role-";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeAdminUser(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `E2E Admin System Settings Role ${sequence}` } });
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
 * CompanySetting is a global singleton, same storefront-footer-wide
 * blast radius STORY-052's admin-navigation.spec.ts already flagged for
 * the nav menu — serial mode plus an immediate afterEach reset keeps
 * this spec from leaking into footer.spec.ts's own parallel assertions.
 */
test.describe("Admin System Settings (STORY-054)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.companySetting.deleteMany({});
    await prisma.featureFlag.deleteMany({ where: { key: { startsWith: "e2e-system-settings-" } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  });

  test.afterEach(async () => {
    await prisma.companySetting.deleteMany({});
    await prisma.featureFlag.deleteMany({ where: { key: { startsWith: "e2e-system-settings-" } } });
  });

  test("updating Company Info in the admin console is reflected on the real storefront footer", async ({ page }) => {
    const admin = await makeAdminUser([
      { module: "SystemSettings", action: "View" },
      { module: "SystemSettings", action: "Edit" },
    ]);

    await signIn(page, admin.email);
    await page.goto("/admin/settings");
    await page.waitForLoadState("networkidle");

    await page.getByLabel("Legal name").fill("E2E Test Foods (Pvt) Ltd");
    await page.getByLabel("Registered address").fill("1 E2E Test Lane, Colombo");
    await page.getByLabel("Phone").fill("+94 77 000 1111");
    await page.getByLabel("Email").fill("e2e-settings@oristor.test");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    await page.goto("/");
    const footer = page.locator("footer");
    await expect(footer.getByText("E2E Test Foods (Pvt) Ltd", { exact: true })).toBeVisible();
    await expect(footer.getByText("1 E2E Test Lane, Colombo")).toBeVisible();
    await expect(footer.getByText("+94 77 000 1111")).toBeVisible();
    await expect(footer.getByText("e2e-settings@oristor.test")).toBeVisible();
  });

  test("adding and toggling a Feature Flag through the admin console takes effect immediately, with no deploy", async ({ page }) => {
    const admin = await makeAdminUser([
      { module: "SystemSettings", action: "View" },
      { module: "SystemSettings", action: "Edit" },
    ]);

    await signIn(page, admin.email);
    await page.goto("/admin/settings");
    await page.waitForLoadState("networkidle");
    await page.getByRole("tab", { name: "Feature Flags" }).click();

    await page.getByPlaceholder("e.g. new_checkout_flow").fill("e2e-system-settings-flag");
    await page.getByPlaceholder("Description (optional)").fill("E2E test flag.");
    await page.getByRole("button", { name: "Add" }).click();
    const row = page.getByRole("row", { name: /e2e-system-settings-flag/ });
    await expect(row).toBeVisible();

    // A single immediate page.request.get() here can race the PGlite
    // dev DB's single pooled connection (DATABASE_POOL_MAX=1) against
    // the browser's own invalidateQueries refetch and read a stale
    // snapshot even after the UI has already re-rendered — poll instead.
    async function readFlag() {
      const response = await page.request.get("/api/admin/settings/feature-flags");
      const flags: { key: string; enabled: boolean }[] = await response.json();
      return flags.find((f) => f.key === "e2e-system-settings-flag")?.enabled;
    }
    await expect.poll(readFlag).toBe(false);

    await row.getByRole("checkbox", { name: "Enabled" }).click();
    await expect(row.getByRole("checkbox", { name: "Enabled" })).toBeChecked();

    await expect.poll(readFlag).toBe(true);
  });

  test("editing a notification template's body, previewing it with sample values, and saving persists the change", async ({ page }) => {
    const admin = await makeAdminUser([
      { module: "SystemSettings", action: "View" },
      { module: "SystemSettings", action: "Edit" },
    ]);
    const template = await prisma.notificationTemplate.create({
      data: { templateKey: "e2e-system-settings-template", channel: "Email", subject: "Original", body: "Hello {{customerName}}." },
    });

    try {
      await signIn(page, admin.email);
      await page.goto("/admin/settings");
      await page.waitForLoadState("networkidle");
      await page.getByRole("tab", { name: "Notifications" }).click();

      const row = page.getByRole("row", { name: /e2e-system-settings-template/ });
      await expect(row).toBeVisible();
      await row.getByRole("button", { name: "Edit" }).click();

      const body = page.getByLabel("Body");
      await body.fill("Hi {{customerName}}, your order {{orderId}} is confirmed.");
      await page.getByLabel("{{customerName}}").fill("Nadeesha");
      await page.getByLabel("{{orderId}}").fill("ORD-1001");
      await page.getByRole("button", { name: "Preview" }).click();
      await expect(page.getByText("Hi Nadeesha, your order ORD-1001 is confirmed.")).toBeVisible();

      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByRole("dialog")).toBeHidden();

      const updated = await prisma.notificationTemplate.findUniqueOrThrow({ where: { id: template.id } });
      expect(updated.body).toBe("Hi {{customerName}}, your order {{orderId}} is confirmed.");
    } finally {
      await prisma.notificationTemplate.delete({ where: { id: template.id } });
    }
  });
});
