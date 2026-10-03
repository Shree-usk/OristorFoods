// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { createZone } from "@/services/delivery-zone.service";
import { upsertZoneRate } from "@/services/delivery-rate.service";
import { deliveryRateInputSchema } from "@/validation/delivery-zone.schema";

const EMAIL_DOMAIN = "@delivery-rate-svc-test.test";
const ROLE_KEY_PREFIX = "delivery-rate-svc-test-role-";
const ZONE_NAME_PREFIX = "Delivery Rate Svc Test Zone ";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Delivery Rate Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

async function makeFullAccessAdmin() {
  return makeAdmin([
    { module: "DeliveryZones", action: "View" },
    { module: "DeliveryZones", action: "Edit" },
  ]);
}

async function makeZone(adminId: string, suffix: string) {
  sequence += 1;
  return createZone(adminId, { name: `${ZONE_NAME_PREFIX}${suffix}${sequence}`, cities: [`DeliveryRateSvcTestCity${sequence}`], isActive: true });
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.deliveryZone.deleteMany({ where: { name: { startsWith: ZONE_NAME_PREFIX } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("delivery-rate.service", () => {
  it("upserts a Flat rate", async () => {
    const admin = await makeFullAccessAdmin();
    const zone = await makeZone(admin.id, "flat");

    const rate = await upsertZoneRate(admin.id, zone.id, { rateType: "Flat", flatAmount: 350 });
    expect(rate.rateType).toBe("Flat");
    expect(rate.flatAmount?.toString()).toBe("350");
    expect(rate.tiers).toBeNull();
  });

  it("upserts a WeightBased rate with tiers, and re-upserting replaces them", async () => {
    const admin = await makeFullAccessAdmin();
    const zone = await makeZone(admin.id, "weight");

    const rate = await upsertZoneRate(admin.id, zone.id, {
      rateType: "WeightBased",
      tiers: [{ upTo: 1000, amount: "200.00" }, { upTo: 5000, amount: "450.00" }],
    });
    expect(rate.tiers).toEqual([{ upTo: 1000, amount: "200.00" }, { upTo: 5000, amount: "450.00" }]);

    const replaced = await upsertZoneRate(admin.id, zone.id, { rateType: "WeightBased", tiers: [{ upTo: 2000, amount: "300.00" }] });
    expect(replaced.tiers).toEqual([{ upTo: 2000, amount: "300.00" }]);
  });

  it("upserts a ValueBased rate with tiers and estimated delivery days", async () => {
    const admin = await makeFullAccessAdmin();
    const zone = await makeZone(admin.id, "value");

    const rate = await upsertZoneRate(admin.id, zone.id, {
      rateType: "ValueBased",
      tiers: [{ upTo: 5000, amount: "500.00" }],
      estimatedDaysMin: 2,
      estimatedDaysMax: 5,
    });
    expect(rate.estimatedDaysMin).toBe(2);
    expect(rate.estimatedDaysMax).toBe(5);
  });
});

describe("deliveryRateInputSchema (validation layer, at the API boundary)", () => {
  it("rejects a Flat rate with no flatAmount", () => {
    expect(deliveryRateInputSchema.safeParse({ rateType: "Flat" }).success).toBe(false);
  });

  it("rejects a WeightBased rate with no tiers", () => {
    expect(deliveryRateInputSchema.safeParse({ rateType: "WeightBased" }).success).toBe(false);
  });

  it("rejects a ValueBased rate with no tiers", () => {
    expect(deliveryRateInputSchema.safeParse({ rateType: "ValueBased" }).success).toBe(false);
  });

  it("accepts a well-formed Flat rate", () => {
    expect(deliveryRateInputSchema.safeParse({ rateType: "Flat", flatAmount: 350 }).success).toBe(true);
  });
});
