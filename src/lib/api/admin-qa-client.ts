/** STORY-046. Fetch wrappers for /api/admin/questions/* — mirrors admin-review-moderation-client.ts's assertOk convention. */

function assertOk(response: Response, message: string): void {
  if (!response.ok) throw new Error(`${message} (${response.status})`);
}

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export type QuestionStatusValue = "Pending" | "Answered" | "Approved" | "Published" | "Rejected";

export interface QaQueueItem {
  id: string;
  submitterName: string;
  submitterEmail: string | null;
  productName: string;
  productHref: string;
  text: string;
  answerText: string | null;
  status: QuestionStatusValue;
  rejectionReason: string | null;
  createdAt: string;
}

export interface QaQueueFilters {
  page?: number;
  pageSize?: number;
  status?: QuestionStatusValue;
  productId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface QaQueueResult {
  items: QaQueueItem[];
  total: number;
}

function queryString(filters: QaQueueFilters): string {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters.status) params.set("status", filters.status);
  if (filters.productId) params.set("productId", filters.productId);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.search) params.set("search", filters.search);
  return params.toString();
}

export async function fetchQaQueue(filters: QaQueueFilters): Promise<QaQueueResult> {
  const response = await fetch(`/api/admin/questions?${queryString(filters)}`);
  assertOk(response, "Failed to load the Q&A queue");
  return response.json();
}

async function postAction(id: string, action: string, fallback: string, body?: unknown) {
  const response = await fetch(`/api/admin/questions/${id}/${action}`, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  await assertOkWithServerMessage(response, fallback);
  return response.json();
}

export const answerQaItem = (id: string, answerText: string) => postAction(id, "answer", "Failed to save answer", { answerText });
export const approveQaItem = (id: string) => postAction(id, "approve", "Failed to approve");
export const rejectQaItem = (id: string, reason: string) => postAction(id, "reject", "Failed to reject", { reason });
export const publishQaItem = (id: string) => postAction(id, "publish", "Failed to publish");

export async function bulkModerateQaItems(ids: string[], action: "approve" | "publish"): Promise<{ updated: string[]; skipped: string[] }> {
  const response = await fetch("/api/admin/questions/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, action }),
  });
  await assertOkWithServerMessage(response, "Failed to bulk moderate");
  return response.json();
}
