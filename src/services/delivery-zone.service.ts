import { parseSimpleCsv } from "@/lib/csv";
import * as deliveryZoneRepository from "@/repositories/delivery-zone.repository";
import * as seasonalCampaignRepository from "@/repositories/seasonal-campaign.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { upsertZoneRate, type DeliveryRateInput } from "@/services/delivery-rate.service";
import { DeliveryZoneCityConflictError, DeliveryZoneError, DeliveryZoneNotFoundError } from "@/services/delivery-zone.errors";
import { requirePermission } from "@/services/permission.service";
import { normalizeCity } from "@/services/shipping.service";
import { deliveryRateInputSchema, deliveryZoneInputSchema } from "@/validation/delivery-zone.schema";
import type { DeliveryRateTiers } from "@/validation/shipping.schema";

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

export interface BulkImportRowResult {
  line: number;
  name: string;
  error?: string;
}

export interface BulkImportResult {
  succeeded: BulkImportRowResult[];
  failed: BulkImportRowResult[];
}

/** "upTo:amount" pairs separated by ";" — the CSV-cell encoding of DeliveryRate.tiers (see parseSimpleCsv's no-quoted-commas limitation). Returns null on any malformed pair. */
function parseTiersCell(raw: string): DeliveryRateTiers | null {
  const tiers = raw
    .split(";")
    .map((pair) => pair.trim())
    .filter((pair) => pair.length > 0)
    .map((pair) => {
      const [upToRaw, amount] = pair.split(":").map((part) => part.trim());
      const upTo = Number(upToRaw);
      return upToRaw && amount && !Number.isNaN(upTo) ? { upTo, amount } : null;
    });
  return tiers.length > 0 && tiers.every((tier) => tier !== null) ? (tiers as DeliveryRateTiers) : null;
}

/**
 * One CSV row = one zone, optionally with its rate in the same row —
 * campaign overrides are out of scope (they're a separate, flat-row-
 * unfriendly concept). Reuses createZone/upsertZoneRate per row rather
 * than reimplementing conflict detection: assertNoCityConflict (above)
 * re-queries the DB fresh on every call, so sequential awaited calls
 * naturally catch a row's cities conflicting with a zone created
 * earlier in the same batch. A per-row result, not an all-or-nothing
 * transaction — mirrors redirect.service.ts::bulkImportRedirects.
 */
export async function bulkImportDeliveryZones(adminUserId: string, csvText: string): Promise<BulkImportResult> {
  await requirePermission(adminUserId, "DeliveryZones", "Edit");

  const rows = parseSimpleCsv(csvText);
  const succeeded: BulkImportRowResult[] = [];
  const failed: BulkImportRowResult[] = [];

  for (const [index, row] of rows.entries()) {
    const line = index + 1;
    const [nameRaw, citiesRaw, isActiveRaw, rateTypeRaw, flatAmountRaw, tiersRaw, minRaw, maxRaw] = row;

    if (line === 1 && nameRaw?.trim().toLowerCase() === "name") continue; // header row

    const name = nameRaw?.trim() ?? "";
    const cities = (citiesRaw ?? "").split(";").map((city) => city.trim()).filter((city) => city.length > 0);
    const isActive = isActiveRaw?.trim().toLowerCase() !== "false";

    const zoneParsed = deliveryZoneInputSchema.safeParse({ name, cities, isActive });
    if (!zoneParsed.success) {
      failed.push({ line, name, error: zoneParsed.error.issues[0]?.message ?? "Invalid zone data." });
      continue;
    }

    const rateType = rateTypeRaw?.trim();
    let rateInput: DeliveryRateInput | null = null;
    if (rateType) {
      if (rateType !== "Flat" && rateType !== "WeightBased" && rateType !== "ValueBased") {
        failed.push({ line, name, error: `rateType must be Flat, WeightBased, or ValueBased (got "${rateType}").` });
        continue;
      }

      let tiers: DeliveryRateTiers | undefined;
      if (tiersRaw?.trim()) {
        const parsedTiers = parseTiersCell(tiersRaw.trim());
        if (!parsedTiers) {
          failed.push({ line, name, error: 'Malformed tiers — expected "upTo:amount" pairs separated by ";".' });
          continue;
        }
        tiers = parsedTiers;
      }

      const rateParsed = deliveryRateInputSchema.safeParse({
        rateType,
        flatAmount: flatAmountRaw?.trim() ? Number(flatAmountRaw.trim()) : undefined,
        tiers,
        estimatedDaysMin: minRaw?.trim() ? Number(minRaw.trim()) : null,
        estimatedDaysMax: maxRaw?.trim() ? Number(maxRaw.trim()) : null,
      });
      if (!rateParsed.success) {
        failed.push({ line, name, error: rateParsed.error.issues[0]?.message ?? "Invalid rate data." });
        continue;
      }
      rateInput = rateParsed.data;
    }

    try {
      const zone = await createZone(adminUserId, zoneParsed.data);
      if (rateInput) await upsertZoneRate(adminUserId, zone.id, rateInput);
      succeeded.push({ line, name });
    } catch (error) {
      failed.push({ line, name, error: error instanceof DeliveryZoneError ? error.message : "Failed to create this zone." });
    }
  }

  await writeAuditLog({ actorId: adminUserId, action: "delivery_zones_bulk_imported", module: "DeliveryZones", metadata: { succeeded: succeeded.length, failed: failed.length } });
  return { succeeded, failed };
}
