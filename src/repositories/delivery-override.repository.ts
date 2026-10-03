import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export function listOverridesForZone(zoneId: string) {
  return prisma.deliveryRateOverride.findMany({ where: { zoneId }, orderBy: { startsAt: "desc" } });
}

export function findOverrideById(id: string) {
  return prisma.deliveryRateOverride.findUnique({ where: { id } });
}

export function createOverride(zoneId: string, input: Omit<Prisma.DeliveryRateOverrideUncheckedCreateInput, "zoneId">) {
  return prisma.deliveryRateOverride.create({ data: { zoneId, ...input } });
}

export function updateOverride(id: string, input: Prisma.DeliveryRateOverrideUncheckedUpdateInput) {
  return prisma.deliveryRateOverride.update({ where: { id }, data: input });
}

export function deleteOverride(id: string) {
  return prisma.deliveryRateOverride.delete({ where: { id } });
}
