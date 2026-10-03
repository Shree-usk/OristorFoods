import * as deliveryZoneRepository from "@/repositories/delivery-zone.repository";
import * as seasonalCampaignRepository from "@/repositories/seasonal-campaign.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { DeliveryZoneCityConflictError, DeliveryZoneNotFoundError } from "@/services/delivery-zone.errors";
import { requirePermission } from "@/services/permission.service";
import { normalizeCity } from "@/services/shipping.service";

/**
 * STORY-055. Admin write-side for DeliveryZone — permission-gated
 * (DeliveryZones, View/Edit/Delete) and audit-logged, mirroring every
 * other admin service this session built. The checkout-side read path
 * (shipping.service.ts, STORY-027) is untouched.
 */

export interface DeliveryZoneInput {
  name: string;
  cities: string[];
  isActive: boolean;
}

async function assertNoCityConflict(cities: string[], excludeZoneId?: string) {
  const activeZones = await deliveryZoneRepository.listActiveZonesExcept(excludeZoneId);
  const normalizedTargets = cities.map(normalizeCity);

  for (const zone of activeZones) {
    const zoneCities = new Set(zone.cities.map(normalizeCity));
    for (let i = 0; i < cities.length; i++) {
      if (zoneCities.has(normalizedTargets[i])) throw new DeliveryZoneCityConflictError(cities[i], zone.name);
    }
  }
}

async function requireZone(id: string) {
  const zone = await deliveryZoneRepository.findZoneById(id);
  if (!zone) throw new DeliveryZoneNotFoundError();
  return zone;
}

export async function listZonesForAdmin(adminUserId: string) {
  await requirePermission(adminUserId, "DeliveryZones", "View");
  return deliveryZoneRepository.listZones();
}

export async function getZoneDetail(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "DeliveryZones", "View");
  return requireZone(id);
}

export async function createZone(adminUserId: string, input: DeliveryZoneInput) {
  await requirePermission(adminUserId, "DeliveryZones", "Edit");
  if (input.isActive) await assertNoCityConflict(input.cities);

  const zone = await deliveryZoneRepository.createZone(input);
  await writeAuditLog({ actorId: adminUserId, action: "delivery_zone_created", module: "DeliveryZones", targetType: "DeliveryZone", targetId: zone.id });
  return zone;
}

export async function updateZone(adminUserId: string, id: string, input: Partial<DeliveryZoneInput>) {
  await requirePermission(adminUserId, "DeliveryZones", "Edit");
  const existing = await requireZone(id);
  const willBeActive = input.isActive ?? existing.isActive;
  const willBeCities = input.cities ?? existing.cities;
  if (willBeActive) await assertNoCityConflict(willBeCities, id);

  const zone = await deliveryZoneRepository.updateZone(id, input);
  await writeAuditLog({ actorId: adminUserId, action: "delivery_zone_updated", module: "DeliveryZones", targetType: "DeliveryZone", targetId: id });
  return zone;
}

export async function deleteZone(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "DeliveryZones", "Delete");
  await requireZone(id);
  await deliveryZoneRepository.deleteZone(id);
  await writeAuditLog({ actorId: adminUserId, action: "delivery_zone_deleted", module: "DeliveryZones", targetType: "DeliveryZone", targetId: id });
}

export async function setZoneActive(adminUserId: string, id: string, isActive: boolean) {
  await requirePermission(adminUserId, "DeliveryZones", "Edit");
  const existing = await requireZone(id);
  if (isActive) await assertNoCityConflict(existing.cities, id);

  const zone = await deliveryZoneRepository.setZoneActive(id, isActive);
  await writeAuditLog({
    actorId: adminUserId,
    action: isActive ? "delivery_zone_activated" : "delivery_zone_deactivated",
    module: "DeliveryZones",
    targetType: "DeliveryZone",
    targetId: id,
  });
  return zone;
}

export async function getCoverageGaps(adminUserId: string) {
  await requirePermission(adminUserId, "DeliveryZones", "View");
  return deliveryZoneRepository.getCoverageGapCities();
}

/** Bypasses Marketing:View — this is a read-only picker for the override form, not a Marketing-module action. */
export async function listCampaignOptions(adminUserId: string) {
  await requirePermission(adminUserId, "DeliveryZones", "View");
  const campaigns = await seasonalCampaignRepository.listSeasonalCampaignsForAdmin();
  return campaigns.map((campaign) => ({ id: campaign.id, name: campaign.name }));
}
