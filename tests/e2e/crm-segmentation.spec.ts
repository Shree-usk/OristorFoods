import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";

const EMAIL_DOMAIN = "@e2e-crm-segmentation.test";
const ROLE_KEY_PREFIX = "e2e-crm-segmentation-role-";
const ORDER_PREFIX = "E2E-CRM-SEG-ORDER-";
const SEGMENT_NAME = "E2E Wholesale High Spenders";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeAdminUser(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `E2E CRM Segmentation Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const admin = await prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "E2E CRM Admin", passwordHash, roleId: role.id } });
  return admin;
}

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** The email domain/role-key/segment-name are all namespaced "e2e-crm-segmentation" so this spec's rows never collide with another spec's fixtures under fullyParallel. */
test.describe("CRM Segmentation (STORY-059a)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.auditLog.deleteMany({ where: { OR: [{ actor: { email: { endsWith: EMAIL_DOMAIN } } }, { module: "CRMAnalytics" }] } });
    await prisma.emailSmsCampaign.deleteMany({ where: { targetSegment: { name: SEGMENT_NAME } } });
    await prisma.savedSegment.deleteMany({ where: { name: SEGMENT_NAME } });
    await prisma.order.deleteMany({ where: { orderNumber: { startsWith: ORDER_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  });

  test.afterEach(async () => {
    await prisma.auditLog.deleteMany({ where: { OR: [{ actor: { email: { endsWith: EMAIL_DOMAIN } } }, { module: "CRMAnalytics" }] } });
    await prisma.emailSmsCampaign.deleteMany({ where: { targetSegment: { name: SEGMENT_NAME } } });
    await prisma.savedSegment.deleteMany({ where: { name: SEGMENT_NAME } });
    await prisma.order.deleteMany({ where: { orderNumber: { startsWith: ORDER_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  });

  test("builds a segment via the real UI, confirms the live preview, saves it, targets it from a campaign, and shows CLV on the customer detail page", async ({ page }) => {
    const admin = await makeAdminUser([
      { module: "CRMAnalytics", action: "View" },
      { module: "CRMAnalytics", action: "Edit" },
      { module: "Customers", action: "View" },
      { module: "Marketing", action: "View" },
      { module: "Marketing", action: "Edit" },
    ]);

    sequence += 1;
    const matchingCustomer = await prisma.user.create({ data: { email: `wholesale${sequence}${EMAIL_DOMAIN}`, name: "Wholesale Whale", customerGroup: "Wholesale" } });
    await prisma.order.create({
      data: {
        orderNumber: `${ORDER_PREFIX}${sequence}`,
        idempotencyKey: `idem-${ORDER_PREFIX}${sequence}`,
        userId: matchingCustomer.id,
        status: "Confirmed",
        subtotal: "800.00",
        deliveryCharge: "0.00",
        grandTotal: "800.00",
        deliveryZoneName: "Western",
        shipRecipientName: "Wholesale Whale",
        shipPhone: "+94 77 123 4567",
        shipLine1: "10 Test Lane",
        shipCity: "Colombo",
      },
    });

    sequence += 1;
    const nonMatchingCustomer = await prisma.user.create({ data: { email: `retail${sequence}${EMAIL_DOMAIN}`, name: "Retail Minnow", customerGroup: "Retail" } });

    await signIn(page, admin.email);
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto("/admin/crm/new");
    await page.getByLabel("Segment name").fill(SEGMENT_NAME);
    await page.getByRole("combobox", { name: "Customer group" }).click();
    await page.getByRole("option", { name: "Wholesale" }).click();

    await expect(page.getByText("Wholesale Whale")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Retail Minnow")).not.toBeVisible();
    await expect(page.getByText("1 customers", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Save segment" }).click();
    await expect(page).toHaveURL(/\/admin\/crm$/);
    await expect(page.getByRole("row", { name: new RegExp(SEGMENT_NAME) })).toBeVisible();

    const segment = await prisma.savedSegment.findFirstOrThrow({ where: { name: SEGMENT_NAME } });

    await page.goto("/admin/marketing/email-sms");
    await page.getByRole("button", { name: "New campaign" }).click();
    await page.getByLabel("Internal name").fill("E2E Segment Campaign");
    await page.getByLabel("Subject").fill("Thanks for being a wholesale partner");
    await page.getByLabel("Message").fill("Hi {{name}}, thanks for being a wholesale partner!");
    await page.getByRole("combobox", { name: "Audience" }).click();
    await page.getByRole("option", { name: "A saved segment" }).click();
    await page.getByRole("combobox", { name: "Saved segment" }).click();
    await page.getByRole("option", { name: SEGMENT_NAME }).click();
    await page.getByRole("button", { name: "Create" }).click();

    await expect(page.getByRole("row", { name: new RegExp(SEGMENT_NAME) })).toBeVisible();

    await page.goto(`/admin/customers/${matchingCustomer.id}`);
    await expect(page.getByText(/Lifetime value: 800\.00/)).toBeVisible();

    await prisma.order.deleteMany({ where: { orderNumber: { startsWith: ORDER_PREFIX } } });
    await prisma.emailSmsCampaign.deleteMany({ where: { targetSegmentId: segment.id } });
    await prisma.user.deleteMany({ where: { id: { in: [matchingCustomer.id, nonMatchingCustomer.id] } } });
  });
});
