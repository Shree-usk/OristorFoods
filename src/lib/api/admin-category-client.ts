async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  sortOrder: number;
  status: "Active" | "Inactive";
  parentId: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  ogImage: string | null;
  children: AdminCategory[];
}

export type CategoryAdminInput = Partial<Omit<AdminCategory, "id" | "children">>;

export async function fetchAdminCategories(): Promise<AdminCategory[]> {
  const response = await fetch("/api/admin/categories");
  if (!response.ok) throw new Error(`Failed to load categories (${response.status})`);
  return response.json();
}

export async function createAdminCategory(input: CategoryAdminInput): Promise<AdminCategory> {
  const response = await fetch("/api/admin/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to create category");
  return response.json();
}

export async function updateAdminCategory(id: string, input: CategoryAdminInput): Promise<AdminCategory> {
  const response = await fetch(`/api/admin/categories/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to save category");
  return response.json();
}
