import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/db";

const EMAIL_DOMAIN = "@e2e-dashboard.test";

test.describe("Customer Dashboard (STORY-033)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  });

  test("unauthenticated visitors are redirected to login with a callbackUrl, and back after signing in", async ({ page }) => {
    const email = `existing${EMAIL_DOMAIN}`;
    await page.goto("/account/register");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("http://localhost:3000/");
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: /Sign Out/ }).click();
    await page.waitForURL("http://localhost:3000/");
    await page.waitForLoadState("networkidle");

    await page.goto("/account");
    await page.waitForURL(/\/account\/login\?callbackUrl=%2Faccount/);

    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("http://localhost:3000/account");
  });

  test("a new customer lands on the dashboard with empty-state widgets and can sign out", async ({ page }) => {
    const email = `new${EMAIL_DOMAIN}`;
    await page.goto("/account/register");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("http://localhost:3000/");

    await page.goto("/account");
    await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
    await expect(page.getByText("No orders yet")).toBeVisible();
    await expect(page.getByText("Start earning points on your first order")).toBeVisible();
    await expect(page.getByText("You haven't saved anything yet")).toBeVisible();
    await expect(page.getByRole("link", { name: "Order History" })).toBeVisible();

    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: /Sign Out/ }).click();
    await page.waitForURL("http://localhost:3000/");

    await page.goto("/account");
    await page.waitForURL(/\/account\/login/);
  });
});
