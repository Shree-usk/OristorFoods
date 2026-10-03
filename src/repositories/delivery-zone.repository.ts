import { prisma } from "@/lib/db";
import { normalizeCity } from "@/services/shipping.service";

/**
 * STORY-055. Admin write-side over `DeliveryZone` — the storefront's
 * read-only resolution path (STORY-027) lives in shipping.repository.ts
 * and is untouched by this file.
 */

export function listZones() {
  return prisma.deliveryZone.findMany({
    include: { rate: true, overrides: { orderBy: { startsAt: "desc" } } },
    orderBy: { name: "asc" },
  });
}

export function findZoneById(id: string) {
  return prisma.deliveryZone.findUnique({
    where: { id },
    include: { rate: true, overrides: { orderBy: { startsAt: "desc" } } },
  });
}

export function createZone(input: { name: string; cities: string[]; isActive: boolean }) {
  return prisma.deliveryZone.create({ data: input });
}

export function updateZone(id: string, input: { name?: string; cities?: string[]; isActive?: boolean }) {
  return prisma.deliveryZone.update({ where: { id }, data: input });
}

export function deleteZone(id: string) {
  return prisma.deliveryZone.delete({ where: { id } });
}

export function setZoneActive(id: string, isActive: boolean) {
  return prisma.deliveryZone.update({ where: { id }, data: { isActive } });
}

/** Every currently-active zone's cities, optionally excluding one zone (the one being edited). */
export async function listActiveZonesExcept(excludeId?: string) {
  return prisma.deliveryZone.findMany({
    where: { isActive: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, name: true, cities: true },
  });
}

/**
 * Cities real customers have actually used (saved addresses + order
 * shipping addresses) that don't match any currently-active zone. There
 * is no master Sri-Lanka-city list anywhere in this codebase — city is
 * free text throughout — so "coverage gap" is grounded in observed
 * demand rather than a speculative list.
 */
export async function getCoverageGapCities(): Promise<string[]> {
  const [addresses, orders, activeZones] = await Promise.all([
    prisma.address.findMany({ select: { city: true }, distinct: ["city"] }),
    prisma.order.findMany({ select: { shipCity: true }, distinct: ["shipCity"] }),
    prisma.deliveryZone.findMany({ where: { isActive: true }, select: { cities: true } }),
  ]);

  const covered = new Set(activeZones.flatMap((zone) => zone.cities.map(normalizeCity)));
  const observed = new Map<string, string>();
  for (const { city } of addresses) observed.set(normalizeCity(city), city);
  for (const { shipCity } of orders) observed.set(normalizeCity(shipCity), shipCity);

  return [...observed.entries()].filter(([normalized]) => !covered.has(normalized)).map(([, original]) => original).sort((a, b) => a.localeCompare(b, "en"));
}
