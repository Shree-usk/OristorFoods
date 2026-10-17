/** Fetch wrappers for /api/admin/export/catalogue/*. */

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export type ProductStatusValue = "Draft" | "Published" | "Archived" | "Discontinued" | "OutOfSeason" | "Review";

export interface ExportCatalogueAdminProductRow {
  id: string;
  sku: string;
  name: string;
  status: ProductStatusValue;
  isExportEnabled: boolean;
  isExportFeatured: boolean;
  exportDisplayOrder: number;
  images: { url: string; altText: string | null }[];
}

export interface ExportCatalogueAdminListFilters {
  search?: string;
  status?: ProductStatusValue;
  page?: number;
}

export interface ExportCatalogueAdminListResult {
  items: ExportCatalogueAdminProductRow[];
  total: number;
}

function toSearchParams(filters: ExportCatalogueAdminListFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== "") params.set(key, String(value));
  return params;
}

export async function fetchExportCatalogueAdminProducts(filters: ExportCatalogueAdminListFilters): Promise<ExportCatalogueAdminListResult> {
  const response = await fetch(`/api/admin/export/catalogue/products?${toSearchParams(filters).toString()}`);
  if (!response.ok) throw new Error(`Failed to load the export catalogue (${response.status})`);
  return response.json();
}

export interface BulkExportVisibilityResult {
  updatedCount: number;
}

export async function bulkSetExportVisibility(ids: string[], isExportEnabled: boolean): Promise<BulkExportVisibilityResult> {
  const response = await fetch("/api/admin/export/catalogue/products/bulk-visibility", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, isExportEnabled }),
  });
  await assertOkWithServerMessage(response, "Failed to update export visibility");
  return response.json();
}

export interface ExportCatalogueSetting {
  id: string;
  title: string | null;
  introText: string | null;
  showPricing: boolean;
  updatedAt: string;
}

export interface ExportCatalogueSettingInput {
  title?: string | null;
  introText?: string | null;
  showPricing?: boolean;
}

export async function fetchExportCatalogueSetting(): Promise<ExportCatalogueSetting | null> {
  const response = await fetch("/api/admin/export/catalogue/settings");
  if (!response.ok) throw new Error(`Failed to load catalogue settings (${response.status})`);
  return response.json();
}

export async function updateExportCatalogueSetting(input: ExportCatalogueSettingInput): Promise<ExportCatalogueSetting> {
  const response = await fetch("/api/admin/export/catalogue/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await assertOkWithServerMessage(response, "Failed to save catalogue settings");
  return response.json();
}
