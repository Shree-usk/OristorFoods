// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { resolveDelivery } from "@/services/shipping.service";

/**
 * DB-integration coverage for resolveDelivery() (shipping-calc.test.ts
 * covers the pure calculation function in isolation). This proves the
 * override date-range filter in shipping.repository.ts actually works —
 * an expired override isn't just theoretically ignored, the query never
 * returns it, so calculateDeliveryCharge never even sees it.
 */

const ZONE_PREFIX = "SHIP-RESOLVE-";

afterEach(async () => {
  await prisma.deliveryRateOverride.deleteMany({ where: { zone: { name: { startsWith: ZONE_PREFIX } } } });
  await prisma.deliveryRate.deleteMany({ where: { zone: { name: { startsWith: ZONE_PREFIX } } } });
  await prisma.deliveryZone.deleteMany({ where: { name: { startsWith: ZONE_PREFIX } } });
  await prisma.shippingSetting.deleteMany({ where: { id: "global" } });
});

const DAY_MS = 24 * 60 * 60 * 1000;

describe("resolveDelivery", () => {
  it("ignores an expired campaign override and falls back to the zone's base rate", async () => {
    await prisma.deliveryZone.create({
      data: {
        name: `${ZONE_PREFIX}Expired`,
        cities: [`${ZONE_PREFIX}City-Expired`],
        rate: { create: { rateType: "Flat", flatAmount: "500.00" } },
        overrides: {
          create: { campaignName: "Expired Deal", startsAt: new Date(Date.now() - 2 * DAY_MS), endsAt: new Date(Date.now() - DAY_MS), freeShipping: true },
        },
      },
    });

    const result = await resolveDelivery(`${ZONE_PREFIX}City-Expired`, 1000, 500);
    expect(result).toMatchObject({ status: "ok", charge: 500, campaignApplied: null });
  });

  it("applies an active campaign override over the base rate", async () => {
    await prisma.deliveryZone.create({
      data: {
        name: `${ZONE_PREFIX}Active`,
        cities: [`${ZONE_PREFIX}City-Active`],
        rate: { create: { rateType: "Flat", flatAmount: "500.00" } },
        overrides: {
          create: { campaignName: "Active Deal", startsAt: new Date(Date.now() - DAY_MS), endsAt: new Date(Date.now() + DAY_MS), freeShipping: true },
        },
      },
    });

    const result = await resolveDelivery(`${ZONE_PREFIX}City-Active`, 1000, 500);
    expect(result).toMatchObject({ status: "ok", charge: 0, campaignApplied: "Active Deal" });
  });

  it("ignores a not-yet-started campaign override and falls back to the zone's base rate", async () => {
    await prisma.deliveryZone.create({
      data: {
        name: `${ZONE_PREFIX}Future`,
        cities: [`${ZONE_PREFIX}City-Future`],
        rate: { create: { rateType: "Flat", flatAmount: "500.00" } },
        overrides: {
          create: { campaignName: "Upcoming Deal", startsAt: new Date(Date.now() + DAY_MS), endsAt: new Date(Date.now() + 2 * DAY_MS), freeShipping: true },
        },
      },
    });

    const result = await resolveDelivery(`${ZONE_PREFIX}City-Future`, 1000, 500);
    expect(result).toMatchObject({ status: "ok", charge: 500, campaignApplied: null });
  });

  it("returns no_zone for a city with no zone configured", async () => {
    const result = await resolveDelivery(`${ZONE_PREFIX}Nonexistent`, 1000, 500);
    expect(result).toEqual({ status: "no_zone" });
  });

  it("ignores an inactive zone even when its city would otherwise match", async () => {
    await prisma.deliveryZone.create({
      data: {
        name: `${ZONE_PREFIX}Inactive`,
        cities: [`${ZONE_PREFIX}City-Inactive`],
        isActive: false,
        rate: { create: { rateType: "Flat", flatAmount: "500.00" } },
      },
    });

    const result = await resolveDelivery(`${ZONE_PREFIX}City-Inactive`, 1000, 500);
    expect(result).toEqual({ status: "no_zone" });
  });
});
