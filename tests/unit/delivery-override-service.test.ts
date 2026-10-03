// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { createZone } from "@/services/delivery-zone.service";
import { createOverride, deleteOverride, listOverridesForZone, updateOverride } from "@/services/delivery-override.service";
import { DeliveryOverrideValidationError } from "@/services/delivery-zone.errors";
import { deliveryOverrideInputSchema } from "@/validation/delivery-zone.schema";

const EMAIL_DOMAIN = "@delivery-override-svc-test.test";
const ROLE_KEY_PREFIX = "delivery-override-svc-test-role-";
const ZONE_NAME_PREFIX = "Delivery Override Svc Test Zone ";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Delivery Override Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

async function makeFullAccessAdmin() {
  return makeAdmin([
    { module: "DeliveryZones", action: "View" },
    { module: "DeliveryZones", action: "Edit" },
  ]);
}

async function makeZone(adminId: string) {
  sequence += 1;
  return createZone(adminId, { name: `${ZONE_NAME_PREFIX}${sequence}`, cities: [`DeliveryOverrideSvcTestCity${sequence}`], isActive: true });
}

const inOneDay = () => new Date(Date.now() + 24 * 60 * 60 * 1000);
const inTwoDays = () => new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.deliveryZone.deleteMany({ where: { name: { startsWith: ZONE_NAME_PREFIX } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("delivery-override.service", () => {
  it("creates, lists, updates, and deletes an override", async () => {
    const admin = await makeFullAccessAdmin();
    const zone = await makeZone(admin.id);

    const override = await createOverride(admin.id, zone.id, {
      campaignName: "Vesak Free Delivery",
      startsAt: inOneDay(),
      endsAt: inTwoDays(),
      freeShipping: true,
    });
    expect(override.freeShipping).toBe(true);

    const list = await listOverridesForZone(admin.id, zone.id);
    expect(list.some((o) => o.id === override.id)).toBe(true);

    const updated = await updateOverride(admin.id, override.id, { campaignName: "Vesak Free Delivery 2026" });
    expect(updated.campaignName).toBe("Vesak Free Delivery 2026");

    await deleteOverride(admin.id, override.id);
    const listAfter = await listOverridesForZone(admin.id, zone.id);
    expect(listAfter.some((o) => o.id === override.id)).toBe(false);
  });

  it("rejects an override whose startsAt is in the past", async () => {
    const admin = await makeFullAccessAdmin();
    const zone = await makeZone(admin.id);

    await expect(
      createOverride(admin.id, zone.id, {
        campaignName: "Backdated Campaign",
        startsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endsAt: inOneDay(),
        freeShipping: true,
      }),
    ).rejects.toBeInstanceOf(DeliveryOverrideValidationError);
  });
});

describe("deliveryOverrideInputSchema (validation layer, at the API boundary)", () => {
  const base = { campaignName: "Test Campaign", startsAt: inOneDay().toISOString(), endsAt: inTwoDays().toISOString() };

  it("rejects when neither freeShipping nor overrideAmount is set", () => {
    expect(deliveryOverrideInputSchema.safeParse(base).success).toBe(false);
  });

  it("rejects when both freeShipping and overrideAmount are set", () => {
    expect(deliveryOverrideInputSchema.safeParse({ ...base, freeShipping: true, overrideAmount: 100 }).success).toBe(false);
  });

  it("accepts freeShipping alone", () => {
    expect(deliveryOverrideInputSchema.safeParse({ ...base, freeShipping: true }).success).toBe(true);
  });

  it("accepts overrideAmount alone", () => {
    expect(deliveryOverrideInputSchema.safeParse({ ...base, overrideAmount: 150 }).success).toBe(true);
  });

  it("rejects endsAt at or before startsAt", () => {
    expect(deliveryOverrideInputSchema.safeParse({ ...base, freeShipping: true, endsAt: base.startsAt }).success).toBe(false);
  });
});
