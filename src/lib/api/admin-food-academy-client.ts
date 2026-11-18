/** Fetch wrappers for /api/admin/food-academy/**. */

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export interface FoodAcademyPageSetting {
  id: string;
  enabled: boolean;
  heroEyebrow: string | null;
  heroHeading: string | null;
  heroDescription: string | null;
  heroPrimaryCtaLabel: string | null;
  heroPrimaryCtaHref: string | null;
  heroSecondaryCtaLabel: string | null;
  heroSecondaryCtaHref: string | null;
  heroImageUrl: string | null;
  heroImageAlt: string | null;
  heroBadgeText: string | null;
  exploreHeading: string | null;
  exploreDescription: string | null;
  featuredHeading: string | null;
  featuredDescription: string | null;
  instagramEnabled: boolean;
  instagramHeading: string | null;
  instagramDescription: string | null;
  instagramCtaLabel: string | null;
  instagramCtaHref: string | null;
  seoTitle: string | null;
  seoMetaDescription: string | null;
  seoCanonicalPath: string | null;
  seoOgImageUrl: string | null;
  updatedAt: string;
}

export type FoodAcademyPageSettingInput = Omit<FoodAcademyPageSetting, "id" | "updatedAt">;

export async function fetchFoodAcademyPageSetting(): Promise<FoodAcademyPageSetting | null> {
  const response = await fetch("/api/admin/food-academy/page-settings");
  if (!response.ok) throw new Error(`Failed to load Food Academy page settings (${response.status})`);
  return response.json();
}

export async function saveFoodAcademyPageSetting(input: FoodAcademyPageSettingInput): Promise<FoodAcademyPageSetting> {
  const response = await fetch("/api/admin/food-academy/page-settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await assertOkWithServerMessage(response, "Failed to save Food Academy page settings.");
  return response.json();
}

export interface FoodAcademyCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  tileImageUrl: string | null;
  tileImageAlt: string | null;
  sortOrder: number;
  status: "Active" | "Inactive";
  _count: { entries: number };
}

export type FoodAcademyCategoryInput = Pick<FoodAcademyCategory, "name" | "slug" | "description" | "tileImageUrl" | "tileImageAlt" | "status">;

export async function fetchFoodAcademyCategories(): Promise<FoodAcademyCategory[]> {
  const response = await fetch("/api/admin/food-academy/categories");
  if (!response.ok) throw new Error(`Failed to load Food Academy categories (${response.status})`);
  return response.json();
}

export async function createFoodAcademyCategory(input: FoodAcademyCategoryInput): Promise<FoodAcademyCategory> {
  const response = await fetch("/api/admin/food-academy/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await assertOkWithServerMessage(response, "Failed to create the category.");
  return response.json();
}

export async function updateFoodAcademyCategory(id: string, input: FoodAcademyCategoryInput): Promise<FoodAcademyCategory> {
  const response = await fetch(`/api/admin/food-academy/categories/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await assertOkWithServerMessage(response, "Failed to update the category.");
  return response.json();
}

export async function deleteFoodAcademyCategory(id: string): Promise<void> {
  const response = await fetch(`/api/admin/food-academy/categories/${id}`, { method: "DELETE" });
  await assertOkWithServerMessage(response, "Failed to delete the category.");
}

export async function reorderFoodAcademyCategories(orderedIds: string[]): Promise<void> {
  const response = await fetch("/api/admin/food-academy/categories/reorder", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderedIds }),
  });
  await assertOkWithServerMessage(response, "Failed to reorder categories.");
}

export type FoodAcademyEntryStatus = "Draft" | "Published";
export type FoodAcademyContentType = "Article" | "Guide" | "Course";

export interface FoodAcademyEntrySection {
  id: string;
  sectionNumber: number;
  title: string;
  bodyContent: string;
  imageUrl: string | null;
}

export interface FoodAcademyEntryAdminDetail {
  id: string;
  slug: string;
  title: string;
  summary: string;
  heroImageUrl: string | null;
  contentType: FoodAcademyContentType;
  categoryId: string;
  category: { id: string; name: string };
  bodyContent: string | null;
  readingTimeMinutes: number | null;
  authorName: string | null;
  isFeatured: boolean;
  sortOrder: number;
  status: FoodAcademyEntryStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sections: FoodAcademyEntrySection[];
  recipeRefs: { recipeId: string }[];
  productRefs: { productId: string }[];
}

export interface FoodAcademyEntryAdminListRow {
  id: string;
  slug: string;
  title: string;
  status: FoodAcademyEntryStatus;
  contentType: FoodAcademyContentType;
  isFeatured: boolean;
  sortOrder: number;
  category: { name: string };
  updatedAt: string;
}

export interface FoodAcademyEntrySectionInput {
  sectionNumber: number;
  title: string;
  bodyContent: string;
  imageUrl: string | null;
}

export interface FoodAcademyEntryInput {
  slug: string;
  title: string;
  summary: string;
  heroImageUrl: string | null;
  contentType: FoodAcademyContentType;
  categoryId: string;
  bodyContent: string | null;
  readingTimeMinutes: number | null;
  authorName: string | null;
  isFeatured: boolean;
  sections: FoodAcademyEntrySectionInput[];
  recipeIds: string[];
  productIds: string[];
}

export interface FoodAcademyEntryListFilters {
  page?: number;
  pageSize?: number;
  status?: FoodAcademyEntryStatus;
  categoryId?: string;
  search?: string;
}

export interface FoodAcademyEntryListResult {
  items: FoodAcademyEntryAdminListRow[];
  total: number;
}

function toEntryQueryString(filters: FoodAcademyEntryListFilters): string {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters.status) params.set("status", filters.status);
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
  if (filters.search) params.set("search", filters.search);
  return params.toString();
}

export async function fetchFoodAcademyEntries(filters: FoodAcademyEntryListFilters): Promise<FoodAcademyEntryListResult> {
  const response = await fetch(`/api/admin/food-academy/entries?${toEntryQueryString(filters)}`);
  if (!response.ok) throw new Error(`Failed to load Food Academy entries (${response.status})`);
  return response.json();
}

export async function fetchFoodAcademyEntry(id: string): Promise<FoodAcademyEntryAdminDetail> {
  const response = await fetch(`/api/admin/food-academy/entries/${id}`);
  if (!response.ok) throw new Error(`Failed to load the entry (${response.status})`);
  return response.json();
}

export interface FoodAcademyEntryFormReferenceData {
  categories: { id: string; name: string; slug: string; description: string | null; tileImageUrl: string | null; tileImageAlt: string | null; sortOrder: number; status: "Active" | "Inactive"; _count: { entries: number } }[];
}

export async function fetchFoodAcademyEntryReferenceData(): Promise<FoodAcademyEntryFormReferenceData> {
  const response = await fetch("/api/admin/food-academy/entries/reference-data");
  if (!response.ok) throw new Error(`Failed to load reference data (${response.status})`);
  return response.json();
}

export async function createFoodAcademyEntry(input: FoodAcademyEntryInput): Promise<FoodAcademyEntryAdminDetail> {
  const response = await fetch("/api/admin/food-academy/entries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await assertOkWithServerMessage(response, "Failed to create the entry.");
  return response.json();
}

export async function updateFoodAcademyEntry(id: string, input: FoodAcademyEntryInput): Promise<FoodAcademyEntryAdminDetail> {
  const response = await fetch(`/api/admin/food-academy/entries/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await assertOkWithServerMessage(response, "Failed to update the entry.");
  return response.json();
}

export async function deleteFoodAcademyEntry(id: string): Promise<void> {
  const response = await fetch(`/api/admin/food-academy/entries/${id}`, { method: "DELETE" });
  await assertOkWithServerMessage(response, "Failed to delete the entry.");
}

export async function publishFoodAcademyEntry(id: string): Promise<FoodAcademyEntryAdminDetail> {
  const response = await fetch(`/api/admin/food-academy/entries/${id}/publish`, { method: "POST" });
  await assertOkWithServerMessage(response, "Failed to publish the entry.");
  return response.json();
}

export async function unpublishFoodAcademyEntry(id: string): Promise<FoodAcademyEntryAdminDetail> {
  const response = await fetch(`/api/admin/food-academy/entries/${id}/unpublish`, { method: "POST" });
  await assertOkWithServerMessage(response, "Failed to unpublish the entry.");
  return response.json();
}

export async function toggleFoodAcademyEntryFeatured(id: string, isFeatured: boolean): Promise<FoodAcademyEntryAdminDetail> {
  const response = await fetch(`/api/admin/food-academy/entries/${id}/featured`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isFeatured }),
  });
  await assertOkWithServerMessage(response, "Failed to update featured status.");
  return response.json();
}

export async function reorderFoodAcademyFeaturedEntries(orderedIds: string[]): Promise<void> {
  const response = await fetch("/api/admin/food-academy/entries/reorder", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderedIds }),
  });
  await assertOkWithServerMessage(response, "Failed to reorder featured entries.");
}
