/** STORY-050d. Admin fetch wrappers for /api/admin/marketing/email-sms — mirrors coupon-admin-client.ts's exact shape. */

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export type CampaignChannelValue = "Email" | "SMS" | "WhatsApp";
export type CampaignAudienceTargetValue = "AllCustomers" | "CustomerGroupTarget" | "LoyaltyMembers" | "ReferralMembers";
export type CampaignStatusValue = "Draft" | "Scheduled" | "Sent";

export interface Campaign {
  id: string;
  name: string;
  channel: CampaignChannelValue;
  audienceTarget: CampaignAudienceTargetValue;
  targetCustomerGroup: string | null;
  subject: string | null;
  body: string;
  status: CampaignStatusValue;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface CampaignFormInput {
  name: string;
  channel: CampaignChannelValue;
  audienceTarget: CampaignAudienceTargetValue;
  targetCustomerGroup: string | null;
  subject: string | null;
  body: string;
  scheduledAt: string | null;
}

export interface CampaignDeliverySummary {
  sent: number;
  failed: number;
  skippedNoConsent: number;
}

export async function fetchCampaigns(): Promise<{ campaigns: Campaign[] }> {
  const response = await fetch("/api/admin/marketing/email-sms");
  if (!response.ok) throw new Error("Failed to load campaigns");
  return response.json();
}

export async function createCampaignAdmin(input: CampaignFormInput): Promise<Campaign> {
  const response = await fetch("/api/admin/marketing/email-sms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to create the campaign");
  return response.json();
}

export async function updateCampaignAdmin(id: string, input: Partial<CampaignFormInput>): Promise<Campaign> {
  const response = await fetch(`/api/admin/marketing/email-sms/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to update the campaign");
  return response.json();
}

export async function sendCampaignNowAdmin(id: string): Promise<Campaign> {
  const response = await fetch(`/api/admin/marketing/email-sms/${id}/send`, { method: "POST" });
  await assertOkWithServerMessage(response, "Failed to send the campaign");
  return response.json();
}

export async function processDueCampaignsAdmin(): Promise<{ processed: number }> {
  const response = await fetch("/api/admin/marketing/email-sms/process-due", { method: "POST" });
  await assertOkWithServerMessage(response, "Failed to process due campaigns");
  return response.json();
}

export async function fetchCampaignDeliverySummary(id: string): Promise<CampaignDeliverySummary> {
  const response = await fetch(`/api/admin/marketing/email-sms/${id}/performance`);
  if (!response.ok) throw new Error("Failed to load delivery summary");
  return response.json();
}
