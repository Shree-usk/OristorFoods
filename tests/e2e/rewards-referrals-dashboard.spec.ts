import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/db";

import { signInAs } from "./helpers/auth";

const EMAIL_DOMAIN = "@e2e-rewards-referrals.test";

test.describe("Reward Wallet & Referral Dashboard (STORY-035)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.referralAttribution.deleteMany({ where: { referred: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.rewardTransaction.deleteMany({ where: { user: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.rewardAccount.deleteMany({ where: { user: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.referralCode.deleteMany({ where: { user: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rewardSetting.upsert({
      where: { id: "global" },
      create: { id: "global", pointsToCurrencyRate: "0.5", maxRedeemablePointsPerOrder: 1000 },
      update: { pointsToCurrencyRate: "0.5", maxRedeemablePointsPerOrder: 1000 },
    });
  });

  test("shows empty states with no reward or referral activity", async ({ page }) => {
    const user = await prisma.user.create({ data: { email: `empty${EMAIL_DOMAIN}` } });
    await signInAs(page, user.id);

    await page.goto("/account/rewards");
    await expect(page.getByText("You haven't earned any points yet")).toBeVisible();

    await page.goto("/account/referrals");
    await expect(page.getByText("You haven't referred anyone yet")).toBeVisible();
  });

  test("shows balance, point history, and a redemption preview", async ({ page }) => {
    const user = await prisma.user.create({ data: { email: `balance${EMAIL_DOMAIN}` } });
    await prisma.rewardTransaction.create({ data: { userId: user.id, type: "Earned", points: 500, orderId: null } });
    await signInAs(page, user.id);

    await page.goto("/account/rewards");
    await expect(page.getByText("500 pts")).toBeVisible();
    await expect(page.getByText("Order placed")).toBeVisible();

    await page.getByRole("button", { name: "Redeem points" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Points to redeem").fill("200");
    await expect(page.getByText("200 points = LKR 100.00 off")).toBeVisible();
    await expect(page.getByText(/redeemed at checkout, not here/)).toBeVisible();
  });

  test("shows the referral link and a referred friend's status", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    const referrer = await prisma.user.create({ data: { email: `referrer${EMAIL_DOMAIN}` } });
    const friend = await prisma.user.create({ data: { email: `friend${EMAIL_DOMAIN}`, name: "Test Friend" } });
    await prisma.referralAttribution.create({ data: { referrerUserId: referrer.id, referredUserId: friend.id, status: "Registered" } });
    await signInAs(page, referrer.id);

    await page.goto("/account/referrals");
    await expect(page.getByText("Test Friend")).toBeVisible();
    await expect(page.getByText("Signed Up")).toBeVisible();

    const linkInput = page.getByLabel("Your referral link");
    const linkValue = await linkInput.inputValue();
    expect(linkValue).toContain("?ref=");

    await page.getByRole("button", { name: "Copy" }).click();
    await expect(page.getByRole("button", { name: "Copied!" })).toBeVisible();
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toBe(linkValue);
  });
});
