import { Prisma } from "@/generated/prisma/client";
import * as deliveryRateRepository from "@/repositories/delivery-rate.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { requirePermission } from "@/services/permission.service";
import type { DeliveryRateTiers } from "@/validation/shipping.schema";

export interface DeliveryRateInput {
  rateType: "Flat" | "WeightBased" | "ValueBased";
  flatAmount?: number;
  tiers?: DeliveryRateTiers;
  estimatedDaysMin?: number | null;
  estimatedDaysMax?: number | null;
}

export async function upsertZoneRate(adminUserId: string, zoneId: string, input: DeliveryRateInput) {
  await requirePermission(adminUserId, "DeliveryZones", "Edit");

  const rate = await deliveryRateRepository.upsertRate(zoneId, {
    rateType: input.rateType,
    flatAmount: input.rateType === "Flat" ? input.flatAmount : null,
    tiers: input.rateType === "Flat" ? Prisma.DbNull : (input.tiers as Prisma.InputJsonValue),
    estimatedDaysMin: input.estimatedDaysMin ?? null,
    estimatedDaysMax: input.estimatedDaysMax ?? null,
  });

  await writeAuditLog({ actorId: adminUserId, action: "delivery_rate_updated", module: "DeliveryZones", targetType: "DeliveryRate", targetId: rate.id });
  return rate;
}
