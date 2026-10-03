import * as deliveryOverrideRepository from "@/repositories/delivery-override.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { DeliveryOverrideNotFoundError, DeliveryOverrideValidationError } from "@/services/delivery-zone.errors";
import { requirePermission } from "@/services/permission.service";

export interface DeliveryOverrideInput {
  campaignName: string;
  startsAt: Date;
  endsAt: Date;
  freeShipping?: boolean;
  overrideAmount?: number;
}

export async function listOverridesForZone(adminUserId: string, zoneId: string) {
  await requirePermission(adminUserId, "DeliveryZones", "View");
  return deliveryOverrideRepository.listOverridesForZone(zoneId);
}

export async function createOverride(adminUserId: string, zoneId: string, input: DeliveryOverrideInput) {
  await requirePermission(adminUserId, "DeliveryZones", "Edit");
  if (input.startsAt.getTime() < Date.now()) throw new DeliveryOverrideValidationError("startsAt cannot be in the past.");

  const override = await deliveryOverrideRepository.createOverride(zoneId, {
    campaignName: input.campaignName,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    freeShipping: input.freeShipping ?? false,
    overrideAmount: input.overrideAmount ?? null,
  });

  await writeAuditLog({ actorId: adminUserId, action: "delivery_override_created", module: "DeliveryZones", targetType: "DeliveryRateOverride", targetId: override.id });
  return override;
}

export async function updateOverride(adminUserId: string, id: string, input: Partial<DeliveryOverrideInput>) {
  await requirePermission(adminUserId, "DeliveryZones", "Edit");
  const existing = await deliveryOverrideRepository.findOverrideById(id);
  if (!existing) throw new DeliveryOverrideNotFoundError();

  const override = await deliveryOverrideRepository.updateOverride(id, {
    ...(input.campaignName !== undefined ? { campaignName: input.campaignName } : {}),
    ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
    ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
    ...(input.freeShipping !== undefined ? { freeShipping: input.freeShipping } : {}),
    ...(input.overrideAmount !== undefined ? { overrideAmount: input.overrideAmount } : {}),
  });

  await writeAuditLog({ actorId: adminUserId, action: "delivery_override_updated", module: "DeliveryZones", targetType: "DeliveryRateOverride", targetId: id });
  return override;
}

export async function deleteOverride(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "DeliveryZones", "Edit");
  const existing = await deliveryOverrideRepository.findOverrideById(id);
  if (!existing) throw new DeliveryOverrideNotFoundError();

  await deliveryOverrideRepository.deleteOverride(id);
  await writeAuditLog({ actorId: adminUserId, action: "delivery_override_deleted", module: "DeliveryZones", targetType: "DeliveryRateOverride", targetId: id });
}
