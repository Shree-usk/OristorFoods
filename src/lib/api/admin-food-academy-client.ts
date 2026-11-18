/** Fetch wrappers for /api/admin/food-academy/**. Entries endpoints land in a later stage. */

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
