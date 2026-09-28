import { prisma } from "@/lib/db";

/**
 * Read-only access to the delivery-zone configuration (STORY-027 thin
 * slice). The admin CRUD that writes these models is STORY-055.
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
