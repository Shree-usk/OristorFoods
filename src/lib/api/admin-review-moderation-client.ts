/** STORY-045. Fetch wrappers for /api/admin/reviews/* — mirrors admin-blog-client.ts's assertOk convention. */

function assertOk(response: Response, message: string): void {
  if (!response.ok) throw new Error(`${message} (${response.status})`);
}

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export type ModerationSourceType = "product" | "recipe" | "blog-comment";

export interface ModerationQueueItem {
  sourceType: ModerationSourceType;
  id: string;
  submitterName: string;
  submitterEmail: string | null;
  targetName: string;
  targetHref: string;
  rating: number | null;
  body: string;
  status: string;
  featured: boolean | null;
  adminReplyBody: string | null;
  createdAt: string;
}

export interface ModerationQueueFilters {
  page?: number;
  pageSize?: number;
  sourceType?: ModerationSourceType;
  status?: string;
  rating?: number;
  search?: string;
}

export interface ModerationQueueResult {
  items: ModerationQueueItem[];
  total: number;
}

function queryString(filters: ModerationQueueFilters): string {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters.sourceType) params.set("sourceType", filters.sourceType);
  if (filters.status) params.set("status", filters.status);
  if (filters.rating) params.set("rating", String(filters.rating));
  if (filters.search) params.set("search", filters.search);
  return params.toString();
}

export async function fetchModerationQueue(filters: ModerationQueueFilters): Promise<ModerationQueueResult> {
  const response = await fetch(`/api/admin/reviews?${queryString(filters)}`);
  assertOk(response, "Failed to load the moderation queue");
  return response.json();
}

async function postAction(sourceType: ModerationSourceType, id: string, action: string, fallback: string, body?: unknown) {
  const response = await fetch(`/api/admin/reviews/${sourceType}/${id}/${action}`, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  await assertOkWithServerMessage(response, fallback);
  return response.json();
}

export const approveModerationItem = (sourceType: ModerationSourceType, id: string) => postAction(sourceType, id, "approve", "Failed to approve");
export const rejectModerationItem = (sourceType: ModerationSourceType, id: string) => postAction(sourceType, id, "reject", "Failed to reject");
export const hideModerationItem = (sourceType: ModerationSourceType, id: string) => postAction(sourceType, id, "hide", "Failed to hide");
export const restoreModerationItem = (id: string) => postAction("product", id, "restore", "Failed to restore");
export const publishModerationItem = (id: string) => postAction("product", id, "publish", "Failed to publish");
export const archiveModerationItem = (id: string) => postAction("product", id, "archive", "Failed to archive");
export const replyToModerationItem = (sourceType: ModerationSourceType, id: string, body: string) => postAction(sourceType, id, "reply", "Failed to save reply", { body });
export const setModerationItemFeatured = (sourceType: ModerationSourceType, id: string, featured: boolean) => postAction(sourceType, id, "feature", "Failed to update featured status", { featured });
export const rewardModerationCustomer = (sourceType: ModerationSourceType, id: string, points: number, note: string) => postAction(sourceType, id, "reward", "Failed to grant reward", { points, note });

export async function bulkModerateItems(items: { sourceType: ModerationSourceType; id: string }[], action: "approve" | "reject"): Promise<{ updated: { sourceType: ModerationSourceType; id: string }[]; skipped: { sourceType: ModerationSourceType; id: string }[] }> {
  const response = await fetch("/api/admin/reviews/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items, action }),
  });
  await assertOkWithServerMessage(response, "Failed to bulk moderate");
  return response.json();
}
