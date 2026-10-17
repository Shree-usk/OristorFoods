async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export interface AdminCollection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  status: "Active" | "Inactive";
  startDate: string | null;
  endDate: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  ogImage: string | null;
  showOnExportPage: boolean;
  isExportFeatured: boolean;
  exportDisplayOrder: number;
  products: { id: string; name: string }[];
}

export type CollectionAdminInput = Partial<Omit<AdminCollection, "id" | "products">> & { productIds?: string[] };

export async function fetchAdminCollections(): Promise<AdminCollection[]> {
  const response = await fetch("/api/admin/collections");
  if (!response.ok) throw new Error(`Failed to load collections (${response.status})`);
  return response.json();
}

export async function createAdminCollection(input: CollectionAdminInput): Promise<AdminCollection> {
  const response = await fetch("/api/admin/collections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to create collection");
  return response.json();
}

export async function updateAdminCollection(id: string, input: CollectionAdminInput): Promise<AdminCollection> {
  const response = await fetch(`/api/admin/collections/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to save collection");
  return response.json();
}
