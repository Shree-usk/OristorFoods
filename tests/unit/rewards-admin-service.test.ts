// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { createProduct } from "@/repositories/product.repository";
import { addItem, getCart } from "@/services/cart.service";
import { PermissionDeniedError } from "@/services/permission.errors";
import { createBadge, createTier, listBadgesForAdmin, listTiersForAdmin, updateBadge, updateRewardSetting, updateTier } from "@/services/rewards.service";

const EMAIL_DOMAIN = "@rewards-admin-svc-test.test";
const ROLE_KEY_PREFIX = "rewards-admin-svc-test-role-";
const SKU_PREFIX = "RWD-ADM-SKU-";
let sequence = 0;

async function makeRole(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Rewards Admin Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return role;
}

async function makeAdminUser(roleId: string) {
  sequence += 1;
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId } });
}

async function makeFullAccessAdmin() {
  const role = await makeRole([
    { module: "RewardsReferrals", action: "View" },
    { module: "RewardsReferrals", action: "Edit" },
  ]);
  return makeAdminUser(role.id);
}

async function makeProduct(rewardPoints: number) {
  sequence += 1;
  const product = await createProduct({
    sku: `${SKU_PREFIX}${sequence}`,
    slug: `${SKU_PREFIX}${sequence}`,
    name: `Rewards Admin Test Product ${sequence}`,
    status: "Published",
    stockQuantity: 10,
    rewardPoints,
    images: { create: [{ url: "/images/products/export/curry-powder.webp", altText: "Test", sortOrder: 0, isPrimary: true }] },
  });
  await prisma.standardPrice.create({ data: { productId: product.id, price: "100.00" } });
  return product;
}

afterEach(async () => {
  await prisma.rewardSetting.deleteMany({ where: { id: "global" } });
  await prisma.rewardTier.deleteMany({ where: { name: { startsWith: "Rewards Admin Test" } } });
  await prisma.badge.deleteMany({ where: { code: { startsWith: "rewards-admin-test-" } } });
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.standardPrice.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
});

describe("rewards.service — updateRewardSetting / orderValuePointsRate additive bonus", () => {
  it("updates the singleton setting, reflected in a subsequent cart read's bonus", async () => {
    const admin = await makeFullAccessAdmin();
    await updateRewardSetting(admin.id, { orderValuePointsRate: 0.1 });

    const product = await makeProduct(0); // isolate the order-value bonus from per-product earning
    const { newCookieValue } = await addItem(null, undefined, product.id, 1);
    const summary = await getCart(null, newCookieValue ?? undefined);

    // subtotal 100.00 * rate 0.1 = 10 bonus points, floor'd
    expect(summary.rewardPointsEarned).toBe(10);

    const log = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "reward_setting_updated" } });
    expect(log).not.toBeNull();
  });

  it("denies a View-only admin", async () => {
    const role = await makeRole([{ module: "RewardsReferrals", action: "View" }]);
    const viewer = await makeAdminUser(role.id);
    await expect(updateRewardSetting(viewer.id, { pointsExpiryDays: 30 })).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe("rewards.service — tier CRUD", () => {
  it("creates and updates a tier", async () => {
    const admin = await makeFullAccessAdmin();
    const tier = await createTier(admin.id, { name: "Rewards Admin Test Platinum", minLifetimePoints: 10000, sortOrder: 99, isActive: true });
    expect(tier.name).toBe("Rewards Admin Test Platinum");

    const updated = await updateTier(admin.id, tier.id, { isActive: false });
    expect(updated.isActive).toBe(false);

    const list = await listTiersForAdmin(admin.id);
    expect(list.some((t) => t.id === tier.id)).toBe(true);
  });
});

describe("rewards.service — badge CRUD", () => {
  it("creates and updates a badge", async () => {
    const admin = await makeFullAccessAdmin();
    const badge = await createBadge(admin.id, { code: "rewards-admin-test-vip", name: "VIP", description: null, criteriaType: "order_count", threshold: 20, isActive: true });
    expect(badge.code).toBe("rewards-admin-test-vip");

    const updated = await updateBadge(admin.id, badge.id, { isActive: false });
    expect(updated.isActive).toBe(false);

    const list = await listBadgesForAdmin(admin.id);
    expect(list.some((b) => b.id === badge.id)).toBe(true);
  });
});
