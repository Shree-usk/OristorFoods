import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { createProduct } from "@/repositories/product.repository";

const EMAIL_DOMAIN = "@e2e-admin-analytics.test";
const ROLE_KEY_PREFIX = "e2e-admin-analytics-role-";
const SKU_PREFIX = "E2E-ANALYTICS-SKU-";
const ORDER_PREFIX = "E2E-ANALYTICS-ORDER-";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeAdminUser(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `E2E Admin Analytics Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "E2E Analytics Admin", passwordHash, roleId: role.id } });
}

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Role keys/SKUs/order numbers are all namespaced "e2e-admin-analytics" so this spec's rows never collide with another spec's fixtures under fullyParallel. */
test.describe("Admin Analytics (STORY-059b)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.orderItem.deleteMany({ where: { order: { orderNumber: { startsWith: ORDER_PREFIX } } } });
    await prisma.order.deleteMany({ where: { orderNumber: { startsWith: ORDER_PREFIX } } });
    await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  });

  test.afterEach(async () => {
    await prisma.orderItem.deleteMany({ where: { order: { orderNumber: { startsWith: ORDER_PREFIX } } } });
    await prisma.order.deleteMany({ where: { orderNumber: { startsWith: ORDER_PREFIX } } });
    await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  });

  test("loads the reports hub with real seeded data and exports a real CSV file", async ({ page }) => {
    const admin = await makeAdminUser([{ module: "CRMAnalytics", action: "View" }]);

    sequence += 1;
    const product = await createProduct({
      sku: `${SKU_PREFIX}${sequence}`,
      slug: `e2e-analytics-product-${sequence}`,
      name: "E2E Analytics Best Seller",
      status: "Published",
      stockQuantity: 100,
    });

    sequence += 1;
    await prisma.order.create({
      data: {
        orderNumber: `${ORDER_PREFIX}${sequence}`,
        idempotencyKey: `idem-${ORDER_PREFIX}${sequence}`,
        status: "Confirmed",
        subtotal: "500.00",
        deliveryCharge: "0.00",
        grandTotal: "500.00",
        deliveryZoneName: "Western",
        shipRecipientName: "Test Customer",
        shipPhone: "+94 77 123 4567",
        shipLine1: "10 Test Lane",
        shipCity: "Colombo",
        items: {
          create: [{ productId: product.id, productName: product.name, productSku: product.sku, unitPrice: "100.00", quantity: 5, lineTotal: "500.00" }],
        },
      },
    });

    await signIn(page, admin.email);
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto("/admin/analytics");
    const from = new Date();
    from.setDate(from.getDate() - 30);
    await page.getByLabel("From").fill(from.toISOString().slice(0, 10));
    await page.getByLabel("To").fill(new Date().toISOString().slice(0, 10));

    await expect(page.getByRole("tab", { name: "Sales" })).toBeVisible();
    await expect(page.getByText("By Category")).toBeVisible();

    await page.getByRole("tab", { name: "Products & Recipes" }).click();
    await expect(page.getByRole("cell", { name: "E2E Analytics Best Seller" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "5", exact: true })).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export CSV" }).first().click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(chunk as Buffer);
    const csvContent = Buffer.concat(chunks).toString("utf-8");
    expect(csvContent).toContain("Product,Quantity Sold,Revenue");
    expect(csvContent).toContain("E2E Analytics Best Seller");

    await page.getByRole("tab", { name: "Funnel" }).click();
    await expect(page.getByText("Not available — no visit tracking exists yet.")).toBeVisible();
    await expect(page.getByText("Confirmed orders")).toBeVisible();
  });
});
