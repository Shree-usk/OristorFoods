import { prisma } from "@/lib/db";

/**
 * Read-only access to the delivery-zone configuration (STORY-027 thin
 * slice) — `DeliveryZone`/rates/overrides. The admin CRUD that writes
 * those is STORY-055. `ShippingSetting` (the single global free-
 * shipping threshold, deliberately not per-zone) is a separate model
 * and this story's own — its admin write function lives here too,
 * since it's the one place this table is touched, but its gated
 * service wrapper is STORY-054's `system-settings.service.ts`.
 */

export function listActiveZonesWithRates(now: Date) {
  return prisma.deliveryZone.findMany({
    where: { isActive: true },
    include: {
      rate: true,
      overrides: {
        where: { startsAt: { lte: now }, endsAt: { gte: now } },
        orderBy: { startsAt: "desc" },
        take: 1,
      },
    },
  });
}

export async function getFreeShippingThreshold(): Promise<number | null> {
  const setting = await prisma.shippingSetting.findUnique({ where: { id: "global" } });
  return setting ? setting.freeShippingThreshold.toNumber() : null;
}

export async function updateFreeShippingThreshold(value: number) {
  const setting = await prisma.shippingSetting.upsert({
    where: { id: "global" },
    create: { id: "global", freeShippingThreshold: value },
    update: { freeShippingThreshold: value },
  });
  return setting.freeShippingThreshold.toNumber();
}
