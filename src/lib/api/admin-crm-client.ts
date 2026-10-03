/** STORY-059a. Fetch wrappers for /api/admin/crm/*. */

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export const CUSTOMER_GROUPS = ["Retail", "Wholesale", "Distributor", "Export", "PrivateLabel"] as const;
export type CustomerGroupValue = (typeof CUSTOMER_GROUPS)[number];

export interface SegmentFilterCriteria {
  minOrderCount?: number;
  maxOrderCount?: number;
  minLifetimeValue?: number;
  maxLifetimeValue?: number;
  city?: string;
  rewardTierId?: string;
  customerGroup?: CustomerGroupValue;
  lastOrderAfter?: string;
  lastOrderBefore?: string;
}

export interface SegmentMember {
  id: string;
  name: string | null;
  email: string | null;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
}

export interface SegmentPreview {
  members: SegmentMember[];
  count: number;
  totalClv: number;
  averageClv: number;
}

export interface SavedSegment {
  id: string;
  name: string;
  filterCriteria: SegmentFilterCriteria;
  createdBy: { id: string; name: string; email: string };
  createdAt: string;
  updatedAt: string;
}

export interface RewardTier {
  id: string;
  name: string;
  minLifetimePoints: number;
  isActive: boolean;
}

export async function fetchSegments(): Promise<SavedSegment[]> {
  const response = await fetch("/api/admin/crm/segments");
  if (!response.ok) throw new Error(`Failed to load segments (${response.status})`);
  return response.json();
}

export async function fetchSegment(id: string): Promise<{ segment: SavedSegment; preview: SegmentPreview }> {
  const response = await fetch(`/api/admin/crm/segments/${id}`);
  if (!response.ok) throw new Error(`Failed to load the segment (${response.status})`);
  return response.json();
}

export async function previewSegmentCriteria(filterCriteria: SegmentFilterCriteria): Promise<SegmentPreview> {
  const response = await fetch("/api/admin/crm/segments/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(filterCriteria) });
  await assertOkWithServerMessage(response, "Failed to preview the segment");
  return response.json();
}

export async function createSegment(name: string, filterCriteria: SegmentFilterCriteria): Promise<SavedSegment> {
  const response = await fetch("/api/admin/crm/segments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, filterCriteria }) });
  await assertOkWithServerMessage(response, "Failed to save the segment");
  return response.json();
}

export async function updateSegment(id: string, name: string, filterCriteria: SegmentFilterCriteria): Promise<SavedSegment> {
  const response = await fetch(`/api/admin/crm/segments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, filterCriteria }) });
  await assertOkWithServerMessage(response, "Failed to save the segment");
  return response.json();
}

export async function deleteSegment(id: string): Promise<void> {
  const response = await fetch(`/api/admin/crm/segments/${id}`, { method: "DELETE" });
  await assertOkWithServerMessage(response, "Failed to delete the segment");
}

export async function fetchRewardTiersForSegmentation(): Promise<RewardTier[]> {
  const response = await fetch("/api/admin/crm/reward-tiers");
  if (!response.ok) throw new Error(`Failed to load reward tiers (${response.status})`);
  return response.json();
}
