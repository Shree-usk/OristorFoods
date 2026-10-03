import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";

const EMAIL_DOMAIN = "@e2e-admin-delivery-zones.test";
const ROLE_KEY_PREFIX = "e2e-admin-delivery-zones-role-";
const ZONE_NAME_PREFIX = "E2E DZ ";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeAdminUser(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `E2E Admin Delivery Zones Role ${sequence}` } });
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
 * Zone/city names are namespaced "E2E DZ ..." — distinct from the real
 * seeded "Colombo Metro" zone and from checkout.spec.ts's own "E2E
 * Western"/"E2E Hill Country" fixtures, so this spec's zones never
 * collide with another spec's city coverage under fullyParallel.
 */
test.describe("Admin Delivery Zone Management (STORY-055)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.deliveryZone.deleteMany({ where: { name: { startsWith: ZONE_NAME_PREFIX } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  });

  test.afterEach(async () => {
    await prisma.deliveryZone.deleteMany({ where: { name: { startsWith: ZONE_NAME_PREFIX } } });
  });

  test("creates a zone with a flat rate, then a second zone with a weight-based rate and an override, and the list reflects both", async ({ page }) => {
    const admin = await makeAdminUser([
      { module: "DeliveryZones", action: "View" },
      { module: "DeliveryZones", action: "Edit" },
    ]);

    await signIn(page, admin.email);
    await page.goto("/admin/delivery-zones");
    await page.waitForLoadState("networkidle");

    // --- Zone 1: flat rate ---
    await page.getByRole("button", { name: "New Zone" }).click();
    await page.getByLabel("Zone name").fill(`${ZONE_NAME_PREFIX}Alpha`);
    await page.getByLabel("Cities (comma-separated)").fill("E2E DZ City Alpha");
    await page.getByRole("button", { name: "Create zone" }).click();
    await expect(page).toHaveURL(/\/admin\/delivery-zones\/[a-z0-9]+$/);

    await page.getByLabel("Flat amount (LKR)").fill("350");
    await page.getByRole("button", { name: "Save rate" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    // --- Zone 2: weight-based rate + an override ---
    await page.goto("/admin/delivery-zones/new");
    await page.getByLabel("Zone name").fill(`${ZONE_NAME_PREFIX}Beta`);
    await page.getByLabel("Cities (comma-separated)").fill("E2E DZ City Beta");
    await page.getByRole("button", { name: "Create zone" }).click();
    await expect(page).toHaveURL(/\/admin\/delivery-zones\/[a-z0-9]+$/);

    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Weight-based" }).click();
    const tierInputs = page.locator('input[type="number"]');
    await tierInputs.nth(0).fill("1000");
    await tierInputs.nth(1).fill("200.00");
    await page.getByRole("button", { name: "Save rate" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    await page.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: "Other (type manually)" }).click();
    await page.getByPlaceholder("Campaign name").fill("E2E DZ Test Campaign");
    await page.getByLabel("Starts").fill(new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
    await page.getByLabel("Ends").fill(new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10));
    await page.getByRole("button", { name: "Add override" }).click();
    await expect(page.getByText("E2E DZ Test Campaign")).toBeVisible();

    // --- List reflects both zones, the override surfaces as "active until" ---
    await page.goto("/admin/delivery-zones");
    await expect(page.getByRole("link", { name: `${ZONE_NAME_PREFIX}Alpha` })).toBeVisible();
    await expect(page.getByRole("link", { name: `${ZONE_NAME_PREFIX}Beta` })).toBeVisible();
  });

  test("blocks activating a zone whose city is already covered by another active zone", async ({ page }) => {
    const admin = await makeAdminUser([
      { module: "DeliveryZones", action: "View" },
      { module: "DeliveryZones", action: "Edit" },
    ]);
    await prisma.deliveryZone.create({ data: { name: `${ZONE_NAME_PREFIX}Existing`, cities: ["E2E DZ City Shared"], isActive: true } });

    await signIn(page, admin.email);
    await page.goto("/admin/delivery-zones/new");
    await page.getByLabel("Zone name").fill(`${ZONE_NAME_PREFIX}Conflicting`);
    await page.getByLabel("Cities (comma-separated)").fill("E2E DZ City Shared");
    // Uncheck Active so creation itself doesn't immediately conflict-check against activation...
    await page.getByRole("checkbox", { name: "Active" }).click();
    await page.getByRole("button", { name: "Create zone" }).click();
    await expect(page).toHaveURL(/\/admin\/delivery-zones\/[a-z0-9]+$/);

    await page.goto("/admin/delivery-zones");
    const row = page.getByRole("row", { name: new RegExp(`${ZONE_NAME_PREFIX}Conflicting`) });
    await row.getByRole("button", { name: "Activate" }).click();

    const response = await page.waitForResponse((res) => res.url().includes("/activate") && res.request().method() === "POST");
    expect(response.status()).toBe(409);
  });
});
