/** STORY-050c. Fetch wrappers for /api/admin/marketing/seasonal-campaigns/* — mirrors popup-admin-client.ts's exact shape. */

function assertOk(response: Response, message: string): void {
  if (!response.ok) throw new Error(`${message} (${response.status})`);
}

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export type SeasonalCampaignStatusValue = "Draft" | "Scheduled" | "Active" | "Ended" | "Archived";

export interface SeasonalCampaignAdmin {
  id: string;
  name: string;
  status: SeasonalCampaignStatusValue;
  startDate: string;
  endDate: string;
  popupId: string | null;
  couponId: string | null;
  emailSmsCampaignId: string | null;
  homepageSectionId: string | null;
  createdAt: string;
}

export type SeasonalCampaignFormInput = Omit<SeasonalCampaignAdmin, "id" | "status" | "createdAt">;

export async function fetchSeasonalCampaigns(): Promise<{ campaigns: SeasonalCampaignAdmin[] }> {
  const response = await fetch("/api/admin/marketing/seasonal-campaigns");
  assertOk(response, "Failed to load seasonal campaigns");
  return response.json();
}

export async function fetchSeasonalCampaign(id: string): Promise<SeasonalCampaignAdmin> {
  const response = await fetch(`/api/admin/marketing/seasonal-campaigns/${id}`);
  assertOk(response, "Failed to load the seasonal campaign");
  return response.json();
}

export async function createSeasonalCampaignAdmin(input: SeasonalCampaignFormInput): Promise<SeasonalCampaignAdmin> {
  const response = await fetch("/api/admin/marketing/seasonal-campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to create the seasonal campaign");
  return response.json();
}

export async function updateSeasonalCampaignAdmin(id: string, input: Partial<SeasonalCampaignFormInput>): Promise<SeasonalCampaignAdmin> {
  const response = await fetch(`/api/admin/marketing/seasonal-campaigns/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to update the seasonal campaign");
  return response.json();
}

export async function changeSeasonalCampaignStatusAdmin(id: string, status: SeasonalCampaignStatusValue): Promise<SeasonalCampaignAdmin> {
  const response = await fetch(`/api/admin/marketing/seasonal-campaigns/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
  await assertOkWithServerMessage(response, "Failed to change the seasonal campaign's status");
  return response.json();
}

export interface SeasonalCampaignPerformanceSummary {
  popup: { impressions: number; clicks: number; dismissals: number } | null;
  coupon: { redemptions: number } | null;
  emailSmsCampaign: { sent: number; failed: number; skippedNoConsent: number } | null;
}

export async function fetchSeasonalCampaignPerformance(id: string): Promise<SeasonalCampaignPerformanceSummary> {
  const response = await fetch(`/api/admin/marketing/seasonal-campaigns/${id}/performance`);
  assertOk(response, "Failed to load performance");
  return response.json();
}
