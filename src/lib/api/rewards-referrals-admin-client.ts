/** STORY-049. Fetch wrappers for /api/admin/rewards/* and /api/admin/referrals/* — mirrors admin-customers-client.ts's conventions. */

function assertOk(response: Response, message: string): void {
  if (!response.ok) throw new Error(`${message} (${response.status})`);
}

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export type CustomerGroupValue = "Retail" | "Wholesale" | "Distributor" | "Export" | "PrivateLabel";
export type FraudFlagStatusValue = "Pending" | "Approved" | "Reversed";

export interface RewardCampaign {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  targetCustomerGroup: CustomerGroupValue | null;
  pointsMultiplier: string;
  isActive: boolean;
}

export interface CampaignInput {
  name: string;
  startDate: string;
  endDate: string;
  targetCustomerGroup: CustomerGroupValue | null;
  pointsMultiplier: number;
  isActive: boolean;
}

export async function fetchCampaigns(): Promise<{ campaigns: RewardCampaign[] }> {
  const response = await fetch("/api/admin/rewards/campaigns");
  assertOk(response, "Failed to load campaigns");
  return response.json();
}

export async function createCampaignAdmin(input: CampaignInput): Promise<RewardCampaign> {
  const response = await fetch("/api/admin/rewards/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to create the campaign");
  return response.json();
}

export async function updateCampaignAdmin(id: string, input: Partial<CampaignInput>): Promise<RewardCampaign> {
  const response = await fetch(`/api/admin/rewards/campaigns/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to update the campaign");
  return response.json();
}

export interface RewardSetting {
  pointsToCurrencyRate: string | null;
  maxRedeemablePointsPerOrder: number | null;
  pointsExpiryDays: number | null;
  orderValuePointsRate: string | null;
}

export async function fetchRewardSetting(): Promise<RewardSetting> {
  const response = await fetch("/api/admin/rewards/settings");
  assertOk(response, "Failed to load point rule settings");
  return response.json();
}

export async function updateRewardSettingAdmin(input: Partial<{ pointsToCurrencyRate: number | null; maxRedeemablePointsPerOrder: number | null; pointsExpiryDays: number | null; orderValuePointsRate: number | null }>): Promise<RewardSetting> {
  const response = await fetch("/api/admin/rewards/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to update point rule settings");
  return response.json();
}

export interface RewardTier {
  id: string;
  name: string;
  minLifetimePoints: number;
  sortOrder: number;
  isActive: boolean;
}

export interface TierInput {
  name: string;
  minLifetimePoints: number;
  sortOrder: number;
  isActive: boolean;
}

export async function fetchTiers(): Promise<{ tiers: RewardTier[] }> {
  const response = await fetch("/api/admin/rewards/tiers");
  assertOk(response, "Failed to load tiers");
  return response.json();
}

export async function createTierAdmin(input: TierInput): Promise<RewardTier> {
  const response = await fetch("/api/admin/rewards/tiers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to create the tier");
  return response.json();
}

export async function updateTierAdmin(id: string, input: Partial<TierInput>): Promise<RewardTier> {
  const response = await fetch(`/api/admin/rewards/tiers/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to update the tier");
  return response.json();
}

export interface Badge {
  id: string;
  code: string;
  name: string;
  description: string | null;
  criteriaType: string;
  threshold: number | null;
  isActive: boolean;
}

export interface BadgeInput {
  code: string;
  name: string;
  description?: string | null;
  criteriaType: string;
  threshold?: number | null;
  isActive: boolean;
}

export async function fetchBadges(): Promise<{ badges: Badge[] }> {
  const response = await fetch("/api/admin/rewards/badges");
  assertOk(response, "Failed to load badges");
  return response.json();
}

export async function createBadgeAdmin(input: BadgeInput): Promise<Badge> {
  const response = await fetch("/api/admin/rewards/badges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to create the badge");
  return response.json();
}

export async function updateBadgeAdmin(id: string, input: Partial<BadgeInput>): Promise<Badge> {
  const response = await fetch(`/api/admin/rewards/badges/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to update the badge");
  return response.json();
}

export interface ReferralSetting {
  referrerBonusPoints: number | null;
  minQualifyingOrderValue: string | null;
  attributionWindowDays: number | null;
  referredWelcomeBonusPoints: number | null;
  maxReferralsPerPeriod: number | null;
  referralPeriodDays: number | null;
}

export async function fetchReferralSetting(): Promise<ReferralSetting> {
  const response = await fetch("/api/admin/referrals/settings");
  assertOk(response, "Failed to load referral rule settings");
  return response.json();
}

export async function updateReferralSettingAdmin(input: Partial<{ referrerBonusPoints: number | null; minQualifyingOrderValue: number | null; attributionWindowDays: number | null; referredWelcomeBonusPoints: number | null; maxReferralsPerPeriod: number | null; referralPeriodDays: number | null }>): Promise<ReferralSetting> {
  const response = await fetch("/api/admin/referrals/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to update referral rule settings");
  return response.json();
}

export interface FraudFlag {
  id: string;
  customerId: string;
  customer: { name: string | null; email: string | null };
  type: string;
  details: Record<string, unknown> | null;
  status: FraudFlagStatusValue;
  createdAt: string;
}

export async function fetchFraudFlags(status?: FraudFlagStatusValue): Promise<{ flags: FraudFlag[]; total: number }> {
  const params = status ? `?status=${status}` : "";
  const response = await fetch(`/api/admin/rewards/fraud-flags${params}`);
  assertOk(response, "Failed to load fraud flags");
  return response.json();
}

export async function approveFraudFlagAdmin(id: string): Promise<void> {
  const response = await fetch(`/api/admin/rewards/fraud-flags/${id}/approve`, { method: "POST" });
  await assertOkWithServerMessage(response, "Failed to approve the flag");
}

export async function reverseFraudFlagAdmin(id: string, note: string): Promise<void> {
  const response = await fetch(`/api/admin/rewards/fraud-flags/${id}/reverse`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }) });
  await assertOkWithServerMessage(response, "Failed to reverse the flag");
}
