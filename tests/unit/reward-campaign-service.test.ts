// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { createProduct } from "@/repositories/product.repository";
import { addItem, getCart } from "@/services/cart.service";
import { PermissionDeniedError } from "@/services/permission.errors";
import { CampaignDateRangeInvalidError } from "@/services/reward-campaign.errors";
import { createCampaign, listCampaignsForAdmin, resolveActiveMultiplier, updateCampaign } from "@/services/reward-campaign.service";

const EMAIL_DOMAIN = "@reward-campaign-svc-test.test";
const ROLE_KEY_PREFIX = "reward-campaign-svc-test-role-";
const SKU_PREFIX = "RWD-CAMP-SKU-";
let sequence = 0;

async function makeRole(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Reward Campaign Svc Test Role ${sequence}` } });
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

async function makeCampaign(overrides: { startDate?: Date; endDate?: Date; targetCustomerGroup?: "Retail" | "Wholesale" | null; pointsMultiplier?: string; isActive?: boolean } = {}) {
  sequence += 1;
  const now = new Date();
  return prisma.rewardCampaign.create({
    data: {
      name: `Test Campaign ${sequence}`,
      startDate: overrides.startDate ?? new Date(now.getTime() - 24 * 60 * 60 * 1000),
      endDate: overrides.endDate ?? new Date(now.getTime() + 24 * 60 * 60 * 1000),
      targetCustomerGroup: overrides.targetCustomerGroup ?? null,
      pointsMultiplier: overrides.pointsMultiplier ?? "2.00",
      isActive: overrides.isActive ?? true,
    },
  });
}

async function makeProduct(rewardPoints: number) {
  sequence += 1;
  const product = await createProduct({
    sku: `${SKU_PREFIX}${sequence}`,
    slug: `${SKU_PREFIX}${sequence}`,
    name: `Reward Campaign Test Product ${sequence}`,
    status: "Published",
    stockQuantity: 10,
    rewardPoints,
    images: { create: [{ url: "/images/products/export/curry-powder.webp", altText: "Test", sortOrder: 0, isPrimary: true }] },
  });
  await prisma.standardPrice.create({ data: { productId: product.id, price: "25.00" } });
  return product;
}

afterEach(async () => {
  await prisma.rewardCampaign.deleteMany({ where: { name: { contains: "Test Campaign" } } });
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

describe("reward-campaign.service — resolveActiveMultiplier", () => {
  it("returns 1 with no active campaign", async () => {
    await expect(resolveActiveMultiplier("Retail")).resolves.toBe(1);
  });

  it("matches a campaign targeting all groups (null)", async () => {
    await makeCampaign({ targetCustomerGroup: null, pointsMultiplier: "3.00" });
    await expect(resolveActiveMultiplier("Wholesale")).resolves.toBe(3);
  });

  it("matches a campaign targeting the exact customer group and ignores a non-matching one", async () => {
    await makeCampaign({ targetCustomerGroup: "Wholesale", pointsMultiplier: "2.50" });
    await expect(resolveActiveMultiplier("Wholesale")).resolves.toBe(2.5);
    await expect(resolveActiveMultiplier("Retail")).resolves.toBe(1);
  });

  it("ignores a campaign outside its date range", async () => {
    await makeCampaign({ startDate: new Date(Date.now() - 48 * 60 * 60 * 1000), endDate: new Date(Date.now() - 24 * 60 * 60 * 1000) });
    await expect(resolveActiveMultiplier("Retail")).resolves.toBe(1);
  });

  it("two overlapping active campaigns: the highest multiplier wins", async () => {
    await makeCampaign({ targetCustomerGroup: null, pointsMultiplier: "1.50" });
    await makeCampaign({ targetCustomerGroup: null, pointsMultiplier: "4.00" });
    await expect(resolveActiveMultiplier("Retail")).resolves.toBe(4);
  });
});

describe("reward-campaign.service — a cart read reflects an active campaign's multiplier", () => {
  it("doubles rewardPointsEarned on the line and the cart total", async () => {
    await makeCampaign({ targetCustomerGroup: null, pointsMultiplier: "2.00" });
    const product = await makeProduct(10);

    const { newCookieValue } = await addItem(null, undefined, product.id, 3);
    const summary = await getCart(null, newCookieValue ?? undefined);

    expect(summary.items[0].rewardPointsEarned).toBe(60); // 10 points * 3 qty * 2x
    expect(summary.rewardPointsEarned).toBe(60);
  });
});

describe("reward-campaign.service — admin CRUD", () => {
  it("creates and updates a campaign, permission-gated and audited", async () => {
    const admin = await makeFullAccessAdmin();
    const created = await createCampaign(admin.id, {
      name: "Avurudu 2x",
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      targetCustomerGroup: null,
      pointsMultiplier: 2,
      isActive: true,
    });
    expect(created.name).toBe("Avurudu 2x");

    const updated = await updateCampaign(admin.id, created.id, { isActive: false });
    expect(updated.isActive).toBe(false);

    const log = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "reward_campaign_created" } });
    expect(log).not.toBeNull();

    const list = await listCampaignsForAdmin(admin.id);
    expect(list.some((campaign) => campaign.id === created.id)).toBe(true);

    await prisma.rewardCampaign.delete({ where: { id: created.id } });
  });

  it("rejects an invalid date range", async () => {
    const admin = await makeFullAccessAdmin();
    await expect(
      createCampaign(admin.id, { name: "Bad range", startDate: new Date(), endDate: new Date(Date.now() - 1000), targetCustomerGroup: null, pointsMultiplier: 2, isActive: true }),
    ).rejects.toBeInstanceOf(CampaignDateRangeInvalidError);
  });

  it("denies a View-only admin from creating a campaign", async () => {
    const role = await makeRole([{ module: "RewardsReferrals", action: "View" }]);
    const viewer = await makeAdminUser(role.id);
    await expect(
      createCampaign(viewer.id, { name: "x", startDate: new Date(), endDate: new Date(Date.now() + 1000), targetCustomerGroup: null, pointsMultiplier: 2, isActive: true }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});
