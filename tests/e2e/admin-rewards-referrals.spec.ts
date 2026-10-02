import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";

const EMAIL_DOMAIN = "@e2e-admin-rewards-referrals.test";
const ROLE_KEY_PREFIX = "e2e-admin-rewards-referrals-role-";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeAdminUser(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `E2E Admin Rewards Referrals Role ${sequence}` } });
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

test.describe("Admin Rewards & Referrals Console (STORY-049)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.fraudFlag.deleteMany({ where: { customer: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.rewardTransaction.deleteMany({ where: { user: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.rewardAccount.deleteMany({ where: { user: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.rewardCampaign.deleteMany({ where: { name: { startsWith: "E2E Campaign" } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  });

  test("creating a campaign doubles a real cart's reward points, verified via the storefront cart API", async ({ page }) => {
    test.setTimeout(90_000);

    const admin = await makeAdminUser([
      { module: "RewardsReferrals", action: "View" },
      { module: "RewardsReferrals", action: "Edit" },
    ]);
    const product = await prisma.product.findFirstOrThrow({ where: { status: "Published", rewardPoints: { gt: 0 } } });

    // Baseline: add the item to a guest cart BEFORE the campaign exists.
    await page.request.post("/api/cart/items", { data: { productId: product.id, quantity: 1 } });
    const before = await (await page.request.get("/api/cart")).json();
    expect(before.rewardPointsEarned).toBe(product.rewardPoints);

    await signInAdmin(page, admin.email);
    await page.goto("/admin/rewards-referrals");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "New campaign" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("E2E Campaign 2x");
    const today = new Date().toISOString().slice(0, 10);
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await dialog.getByLabel("Start date").fill(today);
    await dialog.getByLabel("End date").fill(nextWeek);
    await dialog.getByLabel("Points multiplier").fill("2");
    await dialog.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("E2E Campaign 2x")).toBeVisible({ timeout: 15_000 });

    // Same guest cart, re-read now that an active campaign exists.
    const after = await (await page.request.get("/api/cart")).json();
    expect(after.rewardPointsEarned).toBe(product.rewardPoints * 2);
  });

  test("reversing a fraud flag claws back the related reward points", async ({ page }) => {
    test.setTimeout(90_000);

    const admin = await makeAdminUser([
      { module: "RewardsReferrals", action: "View" },
      { module: "RewardsReferrals", action: "Approve" },
    ]);
    const customer = await prisma.user.create({ data: { email: `e2e-flagged-customer-${Date.now()}${EMAIL_DOMAIN}`, name: "E2E Flagged Customer" } });
    await prisma.rewardAccount.create({ data: { userId: customer.id } });
    const earned = await prisma.rewardTransaction.create({ data: { userId: customer.id, type: "Earned", points: 500, orderId: null } });
    await prisma.fraudFlag.create({ data: { customerId: customer.id, type: "referral_shared_address", relatedRewardTransactionId: earned.id } });

    await signInAdmin(page, admin.email);
    await page.goto("/admin/rewards-referrals");
    await page.waitForLoadState("networkidle");
    await page.getByRole("tab", { name: "Fraud Queue" }).click();
    await expect(page.getByText("referral_shared_address")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Reverse" }).click();
    const reverseDialog = page.getByRole("dialog");
    await reverseDialog.getByPlaceholder("Why this reward is being reversed").fill("Confirmed shared address with referred account.");
    await reverseDialog.getByRole("button", { name: "Reverse", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 15_000 });

    const balance = await prisma.rewardTransaction.aggregate({ where: { userId: customer.id }, _sum: { points: true } });
    expect(balance._sum.points).toBe(0);

    const flag = await prisma.fraudFlag.findFirstOrThrow({ where: { customerId: customer.id } });
    expect(flag.status).toBe("Reversed");
  });
});
