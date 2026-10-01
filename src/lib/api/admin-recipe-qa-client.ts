/** STORY-046.1. Fetch wrappers for /api/admin/recipe-questions/* — mirrors admin-qa-client.ts's assertOk convention. */

function assertOk(response: Response, message: string): void {
  if (!response.ok) throw new Error(`${message} (${response.status})`);
}

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export type RecipeQuestionStatusValue = "Pending" | "Answered" | "Approved" | "Published" | "Rejected";

export interface RecipeQaQueueItem {
  id: string;
  submitterName: string;
  submitterEmail: string | null;
  recipeTitle: string;
  recipeHref: string;
  text: string;
  answerText: string | null;
  status: RecipeQuestionStatusValue;
  rejectionReason: string | null;
  createdAt: string;
}

export interface RecipeQaQueueFilters {
  page?: number;
  pageSize?: number;
  status?: RecipeQuestionStatusValue;
  recipeId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface RecipeQaQueueResult {
  items: RecipeQaQueueItem[];
  total: number;
}

function queryString(filters: RecipeQaQueueFilters): string {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters.status) params.set("status", filters.status);
  if (filters.recipeId) params.set("recipeId", filters.recipeId);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.search) params.set("search", filters.search);
  return params.toString();
}

export async function fetchRecipeQaQueue(filters: RecipeQaQueueFilters): Promise<RecipeQaQueueResult> {
  const response = await fetch(`/api/admin/recipe-questions?${queryString(filters)}`);
  assertOk(response, "Failed to load the Recipe Q&A queue");
  return response.json();
}

async function postAction(id: string, action: string, fallback: string, body?: unknown) {
  const response = await fetch(`/api/admin/recipe-questions/${id}/${action}`, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  await assertOkWithServerMessage(response, fallback);
  return response.json();
}

export const answerRecipeQaItem = (id: string, answerText: string) => postAction(id, "answer", "Failed to save answer", { answerText });
export const approveRecipeQaItem = (id: string) => postAction(id, "approve", "Failed to approve");
export const rejectRecipeQaItem = (id: string, reason: string) => postAction(id, "reject", "Failed to reject", { reason });
export const publishRecipeQaItem = (id: string) => postAction(id, "publish", "Failed to publish");

export async function bulkModerateRecipeQaItems(ids: string[], action: "approve" | "publish"): Promise<{ updated: string[]; skipped: string[] }> {
  const response = await fetch("/api/admin/recipe-questions/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, action }),
  });
  await assertOkWithServerMessage(response, "Failed to bulk moderate");
  return response.json();
}
