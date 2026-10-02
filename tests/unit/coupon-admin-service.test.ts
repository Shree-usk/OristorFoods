// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { addItem } from "@/services/cart.service";
import { applyCouponToCart } from "@/services/coupon.service";
import { CouponCodeTakenError, CouponAdminNotFoundError, PromotionNotFoundError } from "@/services/coupon.errors";
import { CouponScopeNotMetError } from "@/services/coupon.errors";
import { PermissionDeniedError } from "@/services/permission.errors";
import {
  createCoupon,
  createPromotion,
  getCouponAdminDetail,
  getPromotionAdminDetail,
  listCouponsForAdmin,
  listPromotionsForAdmin,
  updateCoupon,
  updatePromotion,
} from "@/services/coupon-admin.service";
import { createProduct } from "@/repositories/product.repository";
import * as couponRepository from "@/repositories/coupon.repository";

const EMAIL_DOMAIN = "@coupon-admin-svc-test.test";
const ROLE_KEY_PREFIX = "coupon-admin-svc-test-role-";
const SKU_PREFIX = "CPN-ADM-SKU-";
const CODE_PREFIX = "CPN-ADM-";
let sequence = 0;

async function makeRole(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Coupon Admin Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return role;
}

async function makeAdminUser(roleId: string) {
  sequence += 1;
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId } });
}

async function makeEditAdmin() {
  const role = await makeRole([
    { module: "Marketing", action: "View" },
    { module: "Marketing", action: "Edit" },
  ]);
  return makeAdminUser(role.id);
}

async function makeViewOnlyAdmin() {
  const role = await makeRole([{ module: "Marketing", action: "View" }]);
  return makeAdminUser(role.id);
}

async function makeProduct(price = "1000.00") {
  sequence += 1;
  const product = await createProduct({
    sku: `${SKU_PREFIX}${sequence}`,
    slug: `cpn-adm-product-${sequence}`,
    name: `Coupon Admin Svc Product ${sequence}`,
    status: "Published",
    stockQuantity: 20,
  });
  await prisma.standardPrice.create({ data: { productId: product.id, price } });
  return product;
}

function nextCode() {
  sequence += 1;
  return `${CODE_PREFIX}${sequence}`;
}

afterEach(async () => {
  await prisma.couponRedemption.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.couponScopeProduct.deleteMany();
  await prisma.couponScopeCategory.deleteMany();
  await prisma.promotionScopeProduct.deleteMany();
  await prisma.promotionScopeCategory.deleteMany();
  await prisma.coupon.deleteMany({ where: { code: { startsWith: CODE_PREFIX } } });
  await prisma.promotion.deleteMany({ where: { name: { startsWith: "Coupon Admin Svc" } } });
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
});

const DAY_MS = 24 * 60 * 60 * 1000;

function schedule() {
  return { startDate: new Date(Date.now() - DAY_MS), endDate: new Date(Date.now() + DAY_MS) };
}

describe("coupon-admin.service: permissions", () => {
  it("a View-only admin cannot create a coupon", async () => {
    const admin = await makeViewOnlyAdmin();
    await expect(
      createCoupon(admin.id, { code: nextCode(), discountType: "PercentageOff", percentOff: "10", amountOff: null, ...schedule(), usageLimitGlobal: null, usageLimitPerCustomer: null }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("a View-only admin can still list coupons", async () => {
    const admin = await makeViewOnlyAdmin();
    await expect(listCouponsForAdmin(admin.id)).resolves.toBeInstanceOf(Array);
  });
});

describe("coupon-admin.service: coupon CRUD", () => {
  it("creates a coupon and writes an audit log entry", async () => {
    const admin = await makeEditAdmin();
    const code = nextCode();
    const coupon = await createCoupon(admin.id, { code, discountType: "PercentageOff", percentOff: "15", amountOff: null, ...schedule(), usageLimitGlobal: null, usageLimitPerCustomer: null });
    expect(coupon.code).toBe(code);

    const log = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "coupon_created", targetId: coupon.id } });
    expect(log).not.toBeNull();
  });

  it("rejects a duplicate code with CouponCodeTakenError", async () => {
    const admin = await makeEditAdmin();
    const code = nextCode();
    await createCoupon(admin.id, { code, discountType: "PercentageOff", percentOff: "10", amountOff: null, ...schedule(), usageLimitGlobal: null, usageLimitPerCustomer: null });
    await expect(
      createCoupon(admin.id, { code, discountType: "PercentageOff", percentOff: "10", amountOff: null, ...schedule(), usageLimitGlobal: null, usageLimitPerCustomer: null }),
    ).rejects.toBeInstanceOf(CouponCodeTakenError);
  });

  it("excludes a STORY-048 customer-restricted coupon from the admin list and from admin detail lookup", async () => {
    const admin = await makeEditAdmin();
    const customer = await prisma.user.create({ data: { email: `restricted-${sequence}${EMAIL_DOMAIN}`, name: "Restricted Customer" } });
    const restricted = await couponRepository.createCoupon({
      code: nextCode(),
      discountType: "PercentageOff",
      percentOff: "10",
      amountOff: null,
      ...schedule(),
      usageLimitGlobal: null,
      usageLimitPerCustomer: null,
      restrictedToUserId: customer.id,
    });

    const list = await listCouponsForAdmin(admin.id);
    expect(list.find((item) => item.id === restricted.id)).toBeUndefined();
    await expect(getCouponAdminDetail(admin.id, restricted.id)).rejects.toBeInstanceOf(CouponAdminNotFoundError);

    await prisma.user.delete({ where: { id: customer.id } });
  });

  it("updates a coupon's scope and isActive", async () => {
    const admin = await makeEditAdmin();
    const product = await makeProduct();
    const coupon = await createCoupon(admin.id, { code: nextCode(), discountType: "PercentageOff", percentOff: "10", amountOff: null, ...schedule(), usageLimitGlobal: null, usageLimitPerCustomer: null });

    const updated = await updateCoupon(admin.id, coupon.id, { scope: "Product", scopeProductIds: [product.id], isActive: false });
    expect(updated.scope).toBe("Product");
    expect(updated.scopeProducts.map((row) => row.productId)).toEqual([product.id]);
    expect(updated.isActive).toBe(false);
  });

  it("a real admin-created, product-scoped coupon is actually wired into checkout: applies to a matching cart, rejected for a non-matching one", async () => {
    const admin = await makeEditAdmin();
    const matchingProduct = await makeProduct();
    const otherProduct = await makeProduct();
    const code = nextCode();

    await createCoupon(admin.id, {
      code,
      discountType: "PercentageOff",
      percentOff: "20",
      amountOff: null,
      ...schedule(),
      usageLimitGlobal: null,
      usageLimitPerCustomer: null,
      scope: "Product",
      scopeProductIds: [matchingProduct.id],
    });

    const { newCookieValue: matchingCart } = await addItem(null, undefined, matchingProduct.id, 1);
    const { summary } = await applyCouponToCart(null, matchingCart!, code);
    expect(summary.couponCode).toBe(code);
    expect(summary.discount).toMatchObject({ amount: 200 });

    const { newCookieValue: nonMatchingCart } = await addItem(null, undefined, otherProduct.id, 1);
    await expect(applyCouponToCart(null, nonMatchingCart!, code)).rejects.toBeInstanceOf(CouponScopeNotMetError);
  });
});

describe("coupon-admin.service: promotion CRUD", () => {
  it("creates and updates a promotion", async () => {
    const admin = await makeEditAdmin();
    sequence += 1;
    const promotion = await createPromotion(admin.id, {
      name: `Coupon Admin Svc Promo ${sequence}`,
      displayLabel: "Admin Svc Test Promo",
      discountType: "PercentageOff",
      percentOff: "10",
      amountOff: null,
      ...schedule(),
      minOrderValue: null,
      scope: "AllProducts",
      stackable: false,
      priority: 0,
      scopeProductIds: [],
      scopeCategoryIds: [],
    });
    expect(promotion.isActive).toBe(true);

    const updated = await updatePromotion(admin.id, promotion.id, { priority: 5, isActive: false });
    expect(updated.priority).toBe(5);
    expect(updated.isActive).toBe(false);

    const list = await listPromotionsForAdmin(admin.id);
    expect(list.find((item) => item.id === promotion.id)).toBeDefined();
  });

  it("404s for a nonexistent promotion id", async () => {
    const admin = await makeEditAdmin();
    await expect(getPromotionAdminDetail(admin.id, "nonexistent-id")).rejects.toBeInstanceOf(PromotionNotFoundError);
  });
});
