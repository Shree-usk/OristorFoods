import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";

const EMAIL_DOMAIN = "@e2e-admin-coupons.test";
const ROLE_KEY_PREFIX = "e2e-admin-coupons-role-";
const SKU_PREFIX = "E2E-ADM-CPN-";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeAdminUser(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `E2E Admin Coupons Role ${sequence}` } });
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

async function seedProduct(n: number, name: string, price: string) {
  const product = await createProduct({ sku: `${SKU_PREFIX}${n}`, slug: `e2e-adm-cpn-product-${n}`, name, status: "Published", stockQuantity: 20 });
  await prisma.standardPrice.create({ data: { productId: product.id, price } });
  return product;
}

test.describe("Admin Coupon Management (STORY-050b)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.couponRedemption.deleteMany();
    await prisma.cartItem.deleteMany();
    await prisma.cart.deleteMany();
    await prisma.couponScopeProduct.deleteMany();
    await prisma.couponScopeCategory.deleteMany();
    await prisma.coupon.deleteMany({ where: { code: { startsWith: "E2EADMCPN" } } });
    await prisma.standardPrice.deleteMany({ where: { product: { sku: { startsWith: SKU_PREFIX } } } });
    await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
    await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  });

  test("an admin creates a product-scoped coupon through the real console, and it's live at checkout: applies to a matching cart, rejected for a non-matching one", async ({ page, browser }) => {
    test.setTimeout(120_000);

    const admin = await makeAdminUser([
      { module: "Marketing", action: "View" },
      { module: "Marketing", action: "Edit" },
      // The scope-product picker reuses the admin products search endpoint (STORY-040), which itself requires Products:View.
      { module: "Products", action: "View" },
    ]);

    const matchingProduct = await seedProduct(1, "E2E Admin Coupon Curry Powder", "1000.00");
    const otherProduct = await seedProduct(2, "E2E Admin Coupon Chilli Flakes", "800.00");

    sequence += 1;
    const code = `E2EADMCPN${sequence}`;

    await signInAdmin(page, admin.email);
    await page.goto("/admin/marketing/coupons");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "New coupon" }).click();
    await page.getByLabel("Code").fill(code);
    await page.getByLabel("Percentage off").fill("20");

    await page.getByLabel("Applies to").click();
    await page.getByRole("option", { name: "Specific products" }).click();
    await page.getByRole("button", { name: "Add product" }).click();
    await page.getByPlaceholder("Search products…").fill(matchingProduct.name);
    await page.getByRole("button", { name: matchingProduct.name }).click();

    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByText(code)).toBeVisible({ timeout: 15_000 });

    const coupon = await prisma.coupon.findUnique({ where: { code } });
    expect(coupon).not.toBeNull();
    const scopeRow = await prisma.couponScopeProduct.findFirst({ where: { couponId: coupon!.id, productId: matchingProduct.id } });
    expect(scopeRow).not.toBeNull();

    // A real, separate storefront visitor applies the admin-created coupon to a matching cart.
    const matchingContext = await browser.newContext();
    const matchingPage = await matchingContext.newPage();
    await matchingPage.request.post("/api/cart/items", { data: { productId: matchingProduct.id, quantity: 1 } });
    await matchingPage.goto("/cart");
    await matchingPage.getByPlaceholder("Coupon code").fill(code);
    await matchingPage.getByRole("button", { name: "Apply" }).click();
    await expect(matchingPage.getByText(`Coupon ${code} applied`)).toBeVisible({ timeout: 10_000 });
    await expect(matchingPage.getByText("−LKR 200.00")).toBeVisible(); // 20% of 1000
    await matchingContext.close();

    // A different visitor with a non-matching cart is rejected.
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await otherPage.request.post("/api/cart/items", { data: { productId: otherProduct.id, quantity: 1 } });
    await otherPage.goto("/cart");
    await otherPage.getByPlaceholder("Coupon code").fill(code);
    await otherPage.getByRole("button", { name: "Apply" }).click();
    await expect(otherPage.getByRole("alert").filter({ hasText: /doesn't contain any items this coupon applies to/i })).toBeVisible({ timeout: 10_000 });
    await otherContext.close();
  });
});
