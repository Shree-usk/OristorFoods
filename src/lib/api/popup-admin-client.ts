/** STORY-050a. Fetch wrappers for /api/admin/marketing/popups/*. */

function assertOk(response: Response, message: string): void {
  if (!response.ok) throw new Error(`${message} (${response.status})`);
}

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export type PopupStatusValue = "Draft" | "Scheduled" | "Published" | "Paused" | "Unpublished" | "Archived";
export type PopupPageTargetValue = "AllPages" | "Homepage" | "Products" | "Recipes" | "Blog";
export type PopupAudienceTargetValue = "AllVisitors" | "NewVisitors" | "ReturningVisitors" | "Authenticated" | "CustomerGroupTarget" | "LoyaltyMembers" | "ReferralMembers";
export type PopupTriggerTypeValue = "Immediate" | "TimeDelay" | "ScrollDepth" | "ExitIntent" | "PageViews" | "AddToCart" | "BeforeCheckout";
export type PopupFrequencyCapValue = "OncePerSession" | "OncePerDay" | "OncePerWeek" | "OncePerCustomer" | "UntilDismissed";
export type CustomerGroupValue = "Retail" | "Wholesale" | "Distributor" | "Export" | "PrivateLabel";

export interface PopupAdmin {
  id: string;
  name: string;
  status: PopupStatusValue;
  title: string;
  description: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  mobileImageUrl: string | null;
  mobileImageAlt: string | null;
  videoUrl: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  secondaryCtaLabel: string | null;
  secondaryCtaHref: string | null;
  couponCode: string | null;
  pageTarget: PopupPageTargetValue;
  audienceTarget: PopupAudienceTargetValue;
  targetCustomerGroup: CustomerGroupValue | null;
  triggerType: PopupTriggerTypeValue;
  triggerValue: number | null;
  frequencyCap: PopupFrequencyCapValue;
  startAt: string | null;
  endAt: string | null;
  variantGroupId: string | null;
  variantWeight: number;
  createdAt: string;
}

export type PopupFormInput = Omit<PopupAdmin, "id" | "status" | "createdAt">;

export async function fetchPopups(): Promise<{ popups: PopupAdmin[] }> {
  const response = await fetch("/api/admin/marketing/popups");
  assertOk(response, "Failed to load popups");
  return response.json();
}

export async function fetchPopup(id: string): Promise<PopupAdmin> {
  const response = await fetch(`/api/admin/marketing/popups/${id}`);
  assertOk(response, "Failed to load the popup");
  return response.json();
}

export async function createPopupAdmin(input: PopupFormInput): Promise<PopupAdmin> {
  const response = await fetch("/api/admin/marketing/popups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to create the popup");
  return response.json();
}

export async function updatePopupAdmin(id: string, input: Partial<PopupFormInput>): Promise<PopupAdmin> {
  const response = await fetch(`/api/admin/marketing/popups/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to update the popup");
  return response.json();
}

export async function changePopupStatusAdmin(id: string, status: PopupStatusValue): Promise<PopupAdmin> {
  const response = await fetch(`/api/admin/marketing/popups/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
  await assertOkWithServerMessage(response, "Failed to change the popup's status");
  return response.json();
}

export interface PopupPerformanceSummary {
  impressions: number;
  clicks: number;
  dismissals: number;
}

export async function fetchPopupPerformance(id: string): Promise<PopupPerformanceSummary> {
  const response = await fetch(`/api/admin/marketing/popups/${id}/performance`);
  assertOk(response, "Failed to load performance");
  return response.json();
}
