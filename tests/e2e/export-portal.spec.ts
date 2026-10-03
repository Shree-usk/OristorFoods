import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";

const EMAIL_DOMAIN = "@e2e-export-portal.test";
const ROLE_KEY_PREFIX = "e2e-export-portal-role-";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeAdminUser(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `E2E Export Portal Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const admin = await prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "E2E Export Admin", passwordHash, roleId: role.id } });
  return admin;
}

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Role keys and the email domain are namespaced "e2e-export-portal" so this spec's rows never collide with another spec's fixtures under fullyParallel. */
test.describe("Export Portal (STORY-058)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.auditLog.deleteMany({ where: { OR: [{ actor: { email: { endsWith: EMAIL_DOMAIN } } }, { module: "ExportPortal" }] } });
    await prisma.distributorAccount.deleteMany({ where: { contactEmail: { endsWith: EMAIL_DOMAIN } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.exportEnquiryNote.deleteMany({ where: { enquiry: { contactEmail: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.exportEnquiry.deleteMany({ where: { contactEmail: { endsWith: EMAIL_DOMAIN } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  });

  test.afterEach(async () => {
    await prisma.auditLog.deleteMany({ where: { OR: [{ actor: { email: { endsWith: EMAIL_DOMAIN } } }, { module: "ExportPortal" }] } });
    await prisma.distributorAccount.deleteMany({ where: { contactEmail: { endsWith: EMAIL_DOMAIN } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.exportEnquiryNote.deleteMany({ where: { enquiry: { contactEmail: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.exportEnquiry.deleteMany({ where: { contactEmail: { endsWith: EMAIL_DOMAIN } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  });

  test("submits a real enquiry through the storefront form, assigns it, wins it, and converts it to a Distributor Account", async ({ page }) => {
    // convertToDistributorAccount awaits a real ~10s Ethereal password-reset
    // email send for the new distributor User in this environment — same
    // real-email-timing lesson as STORY-057's invite flow.
    test.setTimeout(60_000);

    const admin = await makeAdminUser([
      { module: "ExportPortal", action: "View" },
      { module: "ExportPortal", action: "Edit" },
      { module: "ExportPortal", action: "Approve" },
    ]);

    const enquiryEmail = `distributor${Date.now()}${EMAIL_DOMAIN}`;
    await page.goto("/export");
    await page.getByLabel("Company name").fill("Global Imports Ltd");
    await page.getByLabel("Contact name").fill("Alex Buyer");
    await page.getByLabel("Email").fill(enquiryEmail);
    await page.getByLabel("Country").fill("Canada");
    await page.getByLabel("Products of interest").fill("Kithul jaggery, spice blends");
    await page.getByLabel("Tell us about your business").fill("We distribute specialty foods across Ontario and Quebec.");
    await page.getByRole("button", { name: "Send enquiry" }).click();
    await expect(page.getByText("our export team will be in touch")).toBeVisible();

    await signIn(page, admin.email);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/export");

    const row = page.getByRole("row", { name: /Global Imports Ltd/ });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "View" }).click();
    await expect(page).toHaveURL(/\/admin\/export\/[a-z0-9]+$/);

    await expect(page.getByText("Alex Buyer")).toBeVisible();

    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "E2E Export Admin" }).click();
    await expect(page.getByRole("combobox")).toContainText("E2E Export Admin");

    await page.getByRole("button", { name: "Move to In Discussion" }).click();
    await expect(page.getByRole("button", { name: "Move to Quoted" })).toBeVisible();
    await page.getByRole("button", { name: "Move to Quoted" }).click();
    await expect(page.getByRole("button", { name: "Move to Won" })).toBeVisible();
    await page.getByRole("button", { name: "Move to Won" }).click();

    await expect(page.getByLabel("Region")).toBeVisible();
    await page.getByLabel("Region").fill("North America");

    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("/convert") && res.request().method() === "POST", { timeout: 30_000 }),
      page.getByRole("button", { name: "Convert to Distributor Account" }).click(),
    ]);
    expect(response.ok()).toBe(true);
    await expect(page.getByText("Converted to Distributor Account")).toBeVisible();

    const distributorUser = await prisma.user.findUnique({ where: { email: enquiryEmail } });
    expect(distributorUser?.customerGroup).toBe("Distributor");

    await page.goto("/admin/export/distributor-accounts");
    await expect(page.getByRole("row", { name: /Global Imports Ltd/ })).toBeVisible();
  });

  test("moves a second enquiry to Lost and confirms it's visible in the Export Enquiries list", async ({ page }) => {
    const admin = await makeAdminUser([
      { module: "ExportPortal", action: "View" },
      { module: "ExportPortal", action: "Edit" },
    ]);
    const enquiry = await prisma.exportEnquiry.create({
      data: {
        companyName: "Lost Deal Co",
        contactName: "Sam Prospect",
        contactEmail: `lost${Date.now()}${EMAIL_DOMAIN}`,
        country: "France",
        productsOfInterest: "Tea",
        message: "Evaluating suppliers.",
        status: "InDiscussion",
      },
    });

    await signIn(page, admin.email);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto(`/admin/export/${enquiry.id}`);

    await page.getByRole("button", { name: "Move to Lost" }).click();
    await expect(page.getByText("Lost", { exact: true })).toBeVisible();

    await page.goto("/admin/export");
    const row = page.getByRole("row", { name: /Lost Deal Co/ });
    await expect(row).toBeVisible();
    await expect(row.getByText("Lost", { exact: true })).toBeVisible();
  });
});
