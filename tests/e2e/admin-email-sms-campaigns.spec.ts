import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";

const EMAIL_DOMAIN = "@e2e-admin-campaigns.test";
const ROLE_KEY_PREFIX = "e2e-admin-campaigns-role-";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeAdminUser(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `E2E Admin Campaigns Role ${sequence}` } });
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

async function makeCustomer(n: number, group: "Retail" | "Wholesale", phone: string) {
  const user = await prisma.user.create({ data: { email: `customer-${n}${EMAIL_DOMAIN}`, name: `E2E Campaign Customer ${n}`, customerGroup: group } });
  await prisma.notificationPreference.create({ data: { userId: user.id, phone, smsOptIn: true } });
  return user;
}

test.describe("Admin Email/SMS/WhatsApp Campaigns (STORY-050d)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.notificationLog.deleteMany({ where: { recipient: { startsWith: "+9477e2e" } } });
    await prisma.emailSmsCampaign.deleteMany({ where: { createdBy: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.notificationPreference.deleteMany({ where: { user: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  });

  test("an admin creates an SMS campaign scoped to a customer group through the real console, sends it, and only that group's opted-in customers receive it", async ({ page }) => {
    test.setTimeout(120_000);

    const admin = await makeAdminUser([
      { module: "Marketing", action: "View" },
      { module: "Marketing", action: "Edit" },
      { module: "Marketing", action: "Approve" },
    ]);

    sequence += 1;
    const matching = await makeCustomer(sequence, "Wholesale", `+9477e2e${sequence}1`);
    sequence += 1;
    const nonMatching = await makeCustomer(sequence, "Retail", `+9477e2e${sequence}2`);

    sequence += 1;
    const campaignName = `E2E Campaign ${sequence}`;

    await signInAdmin(page, admin.email);
    await page.goto("/admin/marketing/email-sms");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "New campaign" }).click();
    await page.getByLabel("Internal name").fill(campaignName);

    await page.getByLabel("Channel").click();
    await page.getByRole("option", { name: "SMS" }).click();

    await page.getByLabel(/Message/).fill("Hi {{name}}, a wholesale-only offer!");

    await page.getByLabel("Audience").click();
    await page.getByRole("option", { name: "A specific customer group" }).click();
    await page.getByLabel("Customer group").click();
    await page.getByRole("option", { name: "Wholesale", exact: true }).click();

    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByText(campaignName)).toBeVisible({ timeout: 15_000 });

    await page.getByRole("row", { name: new RegExp(campaignName) }).getByRole("button", { name: "Send now" }).click();
    await expect(page.getByRole("row", { name: new RegExp(campaignName) }).getByText("Sent")).toBeVisible({ timeout: 15_000 });

    const campaign = await prisma.emailSmsCampaign.findFirst({ where: { name: campaignName } });
    expect(campaign?.status).toBe("Sent");

    const matchingLog = await prisma.notificationLog.findFirst({ where: { triggeringEventId: campaign!.id, userId: matching.id } });
    expect(matchingLog?.status).toBe("Sent");

    const nonMatchingLog = await prisma.notificationLog.findFirst({ where: { triggeringEventId: campaign!.id, userId: nonMatching.id } });
    expect(nonMatchingLog).toBeNull();
  });
});
