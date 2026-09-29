import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/db";

import { signInAs } from "./helpers/auth";

const EMAIL_DOMAIN = "@e2e-account-settings.test";

test.describe("Account Settings — Addresses & Security (STORY-034)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  });

  test("add, edit, set default, and delete an address", async ({ page }) => {
    const user = await prisma.user.create({ data: { email: `addresses${EMAIL_DOMAIN}` } });
    await signInAs(page, user.id);

    await page.goto("/account/addresses");
    await expect(page.getByText("You haven't saved any addresses yet.")).toBeVisible();

    // Add the first address — it becomes both defaults automatically.
    await page.getByRole("button", { name: "Add address" }).click();
    await page.getByLabel("Recipient name").fill("Nadeesha Silva");
    await page.getByLabel("Phone number").fill("+94 77 111 2222");
    await page.getByLabel("Address line 1").fill("12 Galle Road");
    await page.getByLabel("City").fill("Colombo");
    await page.getByLabel("District").fill("Colombo");
    await page.getByRole("button", { name: "Save address" }).click();
    await expect(page.getByText("Nadeesha Silva")).toBeVisible();
    await expect(page.getByText("Default billing", { exact: true })).toBeVisible();
    await expect(page.getByText("Default shipping", { exact: true })).toBeVisible();

    // Add a second address — not a default yet.
    await page.getByRole("button", { name: "Add address" }).click();
    await page.getByLabel("Recipient name").fill("Kasun Perera");
    await page.getByLabel("Phone number").fill("+94 77 333 4444");
    await page.getByLabel("Address line 1").fill("45 Kandy Road");
    await page.getByLabel("City").fill("Kandy");
    await page.getByLabel("District").fill("Kandy");
    await page.getByRole("button", { name: "Save address" }).click();
    await expect(page.getByText("Kasun Perera")).toBeVisible();

    // Edit the second address's recipient name.
    const kasunCard = page.locator('[data-slot="card"]').filter({ hasText: "Kasun Perera" });
    await kasunCard.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Recipient name").fill("Kasun J. Perera");
    await page.getByRole("button", { name: "Save address" }).click();
    await expect(page.getByText("Kasun J. Perera")).toBeVisible();

    // Set it as the default shipping address — the first address should lose that badge.
    await page.getByRole("button", { name: "Set default shipping" }).click();
    const nadeeshaCard = page.locator('[data-slot="card"]').filter({ hasText: "Nadeesha Silva" });
    await expect(nadeeshaCard.getByText("Default shipping", { exact: true })).not.toBeVisible();

    // Delete the (now non-default-shipping) first address.
    await nadeeshaCard.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Nadeesha Silva")).not.toBeVisible();
    await expect(page.getByText("1 of 10 saved")).toBeVisible();
  });

  test("changing password signs the customer out and the old password stops working", async ({ page }) => {
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash("OldPassword123", 10);
    const user = await prisma.user.create({ data: { email: `security${EMAIL_DOMAIN}`, passwordHash, passwordChangedAt: new Date() } });
    await signInAs(page, user.id);

    await page.goto("/account/security");
    await page.getByLabel("Current password").fill("OldPassword123");
    await page.getByLabel("New password").fill("NewPassword456");
    await page.getByRole("button", { name: "Change password" }).click();
    await page.waitForURL(/\/account\/login/);

    // Old password no longer works; new one does. Locators are exact — the
    // "Password changed" toast (survives the client-side navigation here,
    // mounted once at the app root) otherwise fuzzy-matches "Password".
    await page.getByLabel("Email address").fill(user.email!);
    await page.getByLabel("Password", { exact: true }).fill("OldPassword123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Incorrect email or password.")).toBeVisible();

    await page.getByLabel("Password", { exact: true }).fill("NewPassword456");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("http://localhost:3000/");
  });
});
