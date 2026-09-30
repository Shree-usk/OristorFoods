import type { RecipeAdminFormInput } from "@/validation/recipe-admin.schema";

/** STORY-043. Fetch wrappers for /api/admin/recipes/* — mirrors admin-product-client.ts's assertOk convention. */

function assertOk(response: Response, message: string): void {
  if (!response.ok) throw new Error(`${message} (${response.status})`);
}

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export type RecipeAdminStatus = "Draft" | "Review" | "Approved" | "Published" | "Archived";

export interface AdminRecipeListFilters {
  page?: number;
  pageSize?: number;
  status?: RecipeAdminStatus;
  search?: string;
}

export interface AdminRecipeListRow {
  id: string;
  slug: string;
  title: string;
  status: RecipeAdminStatus;
  updatedAt: string;
  category: { name: string };
}

export interface AdminRecipeListResult {
  items: AdminRecipeListRow[];
  total: number;
}

function toQueryString(filters: AdminRecipeListFilters): string {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  return params.toString();
}

export async function fetchAdminRecipes(filters: AdminRecipeListFilters): Promise<AdminRecipeListResult> {
  const response = await fetch(`/api/admin/recipes?${toQueryString(filters)}`);
  assertOk(response, "Failed to load recipes");
  return response.json();
}

export interface RecipeFormReferenceData {
  categories: { id: string; name: string; slug: string }[];
  dietaryTags: { id: string; name: string; slug: string }[];
}

export async function fetchRecipeFormReferenceData(): Promise<RecipeFormReferenceData> {
  const response = await fetch("/api/admin/recipes/reference-data");
  assertOk(response, "Failed to load reference data");
  return response.json();
}

export async function fetchAdminRecipe(id: string) {
  const response = await fetch(`/api/admin/recipes/${id}`);
  assertOk(response, "Failed to load recipe");
  return response.json();
}

export async function createAdminRecipe(input: RecipeAdminFormInput) {
  const response = await fetch("/api/admin/recipes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await assertOkWithServerMessage(response, "Failed to create recipe");
  return response.json();
}

export async function updateAdminRecipe(id: string, input: RecipeAdminFormInput) {
  const response = await fetch(`/api/admin/recipes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await assertOkWithServerMessage(response, "Failed to save recipe");
  return response.json();
}

export async function deleteAdminRecipe(id: string): Promise<void> {
  const response = await fetch(`/api/admin/recipes/${id}`, { method: "DELETE" });
  await assertOkWithServerMessage(response, "Failed to delete recipe");
}

async function postAction(id: string, action: string, fallback: string, body?: unknown) {
  const response = await fetch(`/api/admin/recipes/${id}/${action}`, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  await assertOkWithServerMessage(response, fallback);
  return response.json();
}

export const submitRecipeForReview = (id: string) => postAction(id, "submit-for-review", "Failed to submit for review");
export const approveRecipe = (id: string) => postAction(id, "approve", "Failed to approve");
export const rejectRecipe = (id: string, comment: string) => postAction(id, "reject", "Failed to reject", { comment });
export const publishRecipe = (id: string) => postAction(id, "publish", "Failed to publish");
export const archiveRecipe = (id: string) => postAction(id, "archive", "Failed to archive");
export const restoreRecipe = (id: string) => postAction(id, "restore", "Failed to restore");
