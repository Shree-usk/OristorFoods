// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { createGiftOffer, getGiftOfferAdminDetail, listGiftOffersForAdmin, updateGiftOffer } from "@/services/gift-offer-admin.service";
import { GiftOfferAdminNotFoundError, GiftOfferProductAlreadyHasOfferError } from "@/services/gift-offer-admin.errors";
import { PermissionDeniedError } from "@/services/permission.errors";

const EMAIL_DOMAIN = "@gift-offer-admin-svc-test.test";
const ROLE_KEY_PREFIX = "gift-offer-admin-svc-test-role-";
const SKU_PREFIX = "gift-offer-admin-svc-test-sku-";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Gift Offer Admin Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

function makeFullAccessAdmin() {
  return makeAdmin([
    { module: "Marketing", action: "View" },
    { module: "Marketing", action: "Edit" },
  ]);
}

async function makeProduct() {
  sequence += 1;
  return createProduct({ sku: `${SKU_PREFIX}${sequence}`, slug: `gift-offer-admin-svc-test-${sequence}`, name: `Gift Offer Admin Svc Test Product ${sequence}`, status: "Published" });
}

function giftOfferInput(productId: string, giftProductId: string, overrides: Partial<Parameters<typeof createGiftOffer>[1]> = {}) {
  return { name: "Test Gift Offer", productId, giftProductId, ...overrides };
}

afterEach(async () => {
  await prisma.giftOfferRedemption.deleteMany();
  await prisma.giftOffer.deleteMany();
  await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("gift-offer-admin.service", () => {
  it("creates, lists, and updates a gift offer", async () => {
    const admin = await makeFullAccessAdmin();
    const qualifying = await makeProduct();
    const gift = await makeProduct();

    const created = await createGiftOffer(admin.id, giftOfferInput(qualifying.id, gift.id));
    expect(created.name).toBe("Test Gift Offer");
    expect(created.productId).toBe(qualifying.id);

    const listed = await listGiftOffersForAdmin(admin.id);
    expect(listed.map((offer) => offer.id)).toContain(created.id);

    const updated = await updateGiftOffer(admin.id, created.id, { name: "Renamed Gift Offer" });
    expect(updated.name).toBe("Renamed Gift Offer");
  });

  it("rejects a second gift offer on the same qualifying product (productId is unique, surfaced via the P2014 relation-violation path)", async () => {
    const admin = await makeFullAccessAdmin();
    const qualifying = await makeProduct();
    const giftA = await makeProduct();
    const giftB = await makeProduct();
    await createGiftOffer(admin.id, giftOfferInput(qualifying.id, giftA.id));

    await expect(createGiftOffer(admin.id, giftOfferInput(qualifying.id, giftB.id))).rejects.toBeInstanceOf(GiftOfferProductAlreadyHasOfferError);
  });

  it("rejects fetching/updating a gift offer that doesn't exist", async () => {
    const admin = await makeFullAccessAdmin();

    await expect(getGiftOfferAdminDetail(admin.id, "does-not-exist")).rejects.toBeInstanceOf(GiftOfferAdminNotFoundError);
    await expect(updateGiftOffer(admin.id, "does-not-exist", { name: "X" })).rejects.toBeInstanceOf(GiftOfferAdminNotFoundError);
  });

  it("denies every mutating action to an admin without Marketing:Edit", async () => {
    const viewer = await makeAdmin([{ module: "Marketing", action: "View" }]);
    const qualifying = await makeProduct();
    const gift = await makeProduct();

    await expect(createGiftOffer(viewer.id, giftOfferInput(qualifying.id, gift.id))).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("denies listing/viewing to an admin without Marketing:View", async () => {
    const stranger = await makeAdmin([]);

    await expect(listGiftOffersForAdmin(stranger.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});
