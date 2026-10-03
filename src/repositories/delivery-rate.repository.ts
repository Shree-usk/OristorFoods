import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export function findRateByZoneId(zoneId: string) {
  return prisma.deliveryRate.findUnique({ where: { zoneId } });
}

export function upsertRate(zoneId: string, input: Omit<Prisma.DeliveryRateUncheckedCreateInput, "zoneId">) {
  return prisma.deliveryRate.upsert({
    where: { zoneId },
    create: { zoneId, ...input },
    update: input,
  });
}
