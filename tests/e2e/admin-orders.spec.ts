import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { createOrder } from "@/services/order.service";

const EMAIL_DOMAIN = "@e2e-admin-orders.test";
const ROLE_KEY_PREFIX = "e2e-admin-orders-role-";
const SKU_PREFIX = "E2E-ADM-ORD-SKU-";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeAdminUser(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `E2E Admin Orders Role ${sequence}` } });
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

async function makeConfirmedOrder() {
  sequence += 1;
  const product = await prisma.product.create({ data: { sku: `${SKU_PREFIX}${sequence}`, slug: `${SKU_PREFIX}${sequence}`, name: `E2E Admin Orders Product ${sequence}`, status: "Published", stockQuantity: 10 } });
  const payment = await prisma.payment.create({ data: { provider: "mock", providerReference: `mock_e2e-adm-ord-${sequence}`, status: "Succeeded", amount: "150.00", currency: "LKR" } });
  const cart = await prisma.cart.create({ data: { guestToken: `e2e-adm-ord-cart-${sequence}` } });
  const { order } = await createOrder({
    userId: null,
    guestToken: "e2e-adm-ord-guest",
    guestEmail: `guest-${sequence}${EMAIL_DOMAIN}`,
    idempotencyKey: crypto.randomUUID(),
    paymentId: payment.id,
    cartId: cart.id,
    subtotal: "100.00",
    deliveryCharge: "50.00",
    discount: "0.00",
    couponCode: null,
    discountLabel: null,
    couponRedemption: null,
    pointsRedeemed: 0,
    pointsRedemptionValue: "0.00",
    pointsRedemption: null,
    grandTotal: "150.00",
    rewardPointsEarned: 10,
    deliveryZoneName: "Western",
    estimatedDaysMin: 1,
    estimatedDaysMax: 3,
    shipRecipientName: "E2E Test Customer",
    shipPhone: "+94 77 123 4567",
    shipLine1: "10 Test Lane",
    shipLine2: null,
    shipCity: "Colombo",
    shipDistrict: null,
    shipPostalCode: null,
    items: [{ productId: product.id, productName: product.name, productSku: product.sku, unitPrice: "50.00", quantity: 2, lineTotal: "100.00", rewardPointsEarned: 2 }],
  });
  return { order, product };
}

test.describe("Admin Orders Console (STORY-047)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.refundRecord.deleteMany({ where: { order: { guestEmail: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.returnRequest.deleteMany({ where: { order: { guestEmail: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.orderStatusHistory.deleteMany({ where: { order: { guestEmail: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.orderItem.deleteMany({ where: { order: { guestEmail: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.order.deleteMany({ where: { guestEmail: { endsWith: EMAIL_DOMAIN } } });
    await prisma.payment.deleteMany({ where: { providerReference: { startsWith: "mock_e2e-adm-ord-" } } });
    await prisma.cart.deleteMany({ where: { guestToken: { startsWith: "e2e-adm-ord-cart-" } } });
    await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  });

  test("walks an order Confirmed -> Processing -> Dispatched -> Delivered, downloads all three documents, then issues a partial refund", async ({ page }) => {
    test.setTimeout(90_000);

    const admin = await makeAdminUser([
      { module: "Orders", action: "View" },
      { module: "Orders", action: "Edit" },
      { module: "Orders", action: "Approve" },
    ]);
    const { order } = await makeConfirmedOrder();

    await signIn(page, admin.email);
    await page.goto(`/admin/orders/${order.id}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: order.orderNumber })).toBeVisible();

    await page.getByRole("button", { name: "Mark as Processing" }).click();
    await expect(page.getByText("Processing", { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Mark as Dispatched" }).click();
    await expect(page.getByText("Dispatched", { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Mark as Delivered" }).click();
    await expect(page.getByText("Delivered", { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
    for (const path of ["invoice", "packing-slip", "shipping-label"]) {
      const response = await page.request.get(`/api/admin/orders/${order.id}/${path}`, { headers: { Cookie: cookieHeader } });
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("application/pdf");
    }

    await page.getByRole("button", { name: "Refund" }).click();
    await page.getByLabel("Amount").fill("50");
    await page.getByLabel("Reason").fill("Partial refund — one item arrived damaged.");
    await page.getByRole("button", { name: "Issue refund" }).click();
    await expect(page.getByRole("heading", { name: "Refunds" })).toBeVisible({ timeout: 15_000 });

    const refund = await prisma.refundRecord.findFirst({ where: { orderId: order.id } });
    expect(refund?.amount.toNumber()).toBe(50);
  });

  test("records a return with restock, marking the order Returned and the stock quantity increased", async ({ page }) => {
    test.setTimeout(90_000);

    const admin = await makeAdminUser([
      { module: "Orders", action: "View" },
      { module: "Orders", action: "Edit" },
      { module: "Orders", action: "Approve" },
    ]);
    const { order, product } = await makeConfirmedOrder();
    await prisma.order.update({ where: { id: order.id }, data: { status: "Delivered" } });
    await prisma.orderStatusHistory.create({ data: { orderId: order.id, status: "Delivered", actor: "system:test-setup" } });

    const beforeStock = (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stockQuantity;

    await signIn(page, admin.email);
    await page.goto(`/admin/orders/${order.id}`);
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Record return" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("combobox").click();
    await page.getByRole("option", { name: "Damaged" }).click();
    await dialog.getByRole("button", { name: "Save return" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 15_000 });

    await expect(page.getByText("Returned", { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    const refreshedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(refreshedOrder.status).toBe("Returned");

    const refreshedProduct = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(refreshedProduct.stockQuantity).toBe(beforeStock + 2);
  });
});
