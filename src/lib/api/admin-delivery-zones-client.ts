/** STORY-055. Fetch wrappers for /api/admin/delivery-zones/*. */

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export type DeliveryRateTypeValue = "Flat" | "WeightBased" | "ValueBased";

export interface DeliveryRateTier {
  upTo: number;
  amount: string;
}

export interface DeliveryRate {
  id: string;
  zoneId: string;
  rateType: DeliveryRateTypeValue;
  flatAmount: string | null;
  tiers: DeliveryRateTier[] | null;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
}

export interface DeliveryRateOverride {
  id: string;
  zoneId: string;
  campaignName: string;
  startsAt: string;
  endsAt: string;
  freeShipping: boolean;
  overrideAmount: string | null;
}

export interface DeliveryZone {
  id: string;
  name: string;
  cities: string[];
  isActive: boolean;
  rate: DeliveryRate | null;
  overrides: DeliveryRateOverride[];
}

export interface DeliveryZoneInput {
  name: string;
  cities: string[];
  isActive: boolean;
}

export async function fetchZones(): Promise<DeliveryZone[]> {
  const response = await fetch("/api/admin/delivery-zones");
  if (!response.ok) throw new Error(`Failed to load delivery zones (${response.status})`);
  return response.json();
}

export async function fetchZone(id: string): Promise<DeliveryZone> {
  const response = await fetch(`/api/admin/delivery-zones/${id}`);
  if (!response.ok) throw new Error(`Failed to load the delivery zone (${response.status})`);
  return response.json();
}

export async function createZone(input: DeliveryZoneInput): Promise<DeliveryZone> {
  const response = await fetch("/api/admin/delivery-zones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to create the delivery zone");
  return response.json();
}

export async function updateZone(id: string, input: Partial<DeliveryZoneInput>): Promise<DeliveryZone> {
  const response = await fetch(`/api/admin/delivery-zones/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to update the delivery zone");
  return response.json();
}

export async function deleteZone(id: string): Promise<void> {
  const response = await fetch(`/api/admin/delivery-zones/${id}`, { method: "DELETE" });
  await assertOkWithServerMessage(response, "Failed to delete the delivery zone");
}

export async function activateZone(id: string): Promise<DeliveryZone> {
  const response = await fetch(`/api/admin/delivery-zones/${id}/activate`, { method: "POST" });
  await assertOkWithServerMessage(response, "Failed to activate the delivery zone");
  return response.json();
}

export async function deactivateZone(id: string): Promise<DeliveryZone> {
  const response = await fetch(`/api/admin/delivery-zones/${id}/deactivate`, { method: "POST" });
  await assertOkWithServerMessage(response, "Failed to deactivate the delivery zone");
  return response.json();
}

export interface DeliveryRateInput {
  rateType: DeliveryRateTypeValue;
  flatAmount?: number;
  tiers?: DeliveryRateTier[];
  estimatedDaysMin?: number | null;
  estimatedDaysMax?: number | null;
}

export async function upsertZoneRate(zoneId: string, input: DeliveryRateInput): Promise<DeliveryRate> {
  const response = await fetch(`/api/admin/delivery-zones/${zoneId}/rate`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to save the zone's rate");
  return response.json();
}

export interface DeliveryOverrideInput {
  campaignName: string;
  startsAt: string;
  endsAt: string;
  freeShipping?: boolean;
  overrideAmount?: number;
}

export async function fetchOverrides(zoneId: string): Promise<DeliveryRateOverride[]> {
  const response = await fetch(`/api/admin/delivery-zones/${zoneId}/overrides`);
  if (!response.ok) throw new Error(`Failed to load overrides (${response.status})`);
  return response.json();
}

export async function createOverride(zoneId: string, input: DeliveryOverrideInput): Promise<DeliveryRateOverride> {
  const response = await fetch(`/api/admin/delivery-zones/${zoneId}/overrides`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to create the override");
  return response.json();
}

export async function deleteOverride(zoneId: string, overrideId: string): Promise<void> {
  const response = await fetch(`/api/admin/delivery-zones/${zoneId}/overrides/${overrideId}`, { method: "DELETE" });
  await assertOkWithServerMessage(response, "Failed to remove the override");
}

export async function fetchCoverageGaps(): Promise<string[]> {
  const response = await fetch("/api/admin/delivery-zones/coverage-gaps");
  if (!response.ok) throw new Error(`Failed to load coverage gaps (${response.status})`);
  return response.json();
}

export interface CampaignOption {
  id: string;
  name: string;
}

export async function fetchCampaignOptions(): Promise<CampaignOption[]> {
  const response = await fetch("/api/admin/delivery-zones/campaigns");
  if (!response.ok) throw new Error(`Failed to load campaigns (${response.status})`);
  return response.json();
}
