/** Fetch wrappers for the public /api/export/catalogue/* routes. */

export interface ExportCatalogueProductCollection {
  id: string;
  name: string;
  slug: string;
}

export interface ExportCatalogueProduct {
  id: string;
  sku: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  exportDescription: string | null;
  weightGrams: number | null;
  isExportFeatured: boolean;
  collections: ExportCatalogueProductCollection[];
  images: { url: string; altText: string | null }[];
}

export interface ExportCatalogueProductPage {
  items: ExportCatalogueProduct[];
  total: number;
}

export interface ExportCatalogueProductQuery {
  search?: string;
  collectionSlug?: string;
  page?: number;
  pageSize?: number;
}

export async function fetchExportCatalogueProducts(query: ExportCatalogueProductQuery, signal?: AbortSignal): Promise<ExportCatalogueProductPage> {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.collectionSlug) params.set("collectionSlug", query.collectionSlug);
  params.set("page", String(query.page ?? 1));
  params.set("pageSize", String(query.pageSize ?? 24));

  const response = await fetch(`/api/export/catalogue/products?${params.toString()}`, { signal });
  if (!response.ok) throw new Error(`Failed to load the export catalogue (${response.status})`);
  return (await response.json()) as ExportCatalogueProductPage;
}

export async function downloadExportCataloguePdf(productIds: string[]): Promise<void> {
  const response = await fetch("/api/export/catalogue/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productIds }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Failed to generate the catalogue PDF" }));
    throw new Error(body.error ?? "Failed to generate the catalogue PDF");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "oristor-export-catalogue.pdf";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
