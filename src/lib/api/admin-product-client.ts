import type { ProductAdminFormInput } from "@/validation/product-admin.schema";

/** STORY-040. Fetch wrappers for /api/admin/products/* — mirrors wishlist-client.ts's assertOk convention. */

function assertOk(response: Response, message: string): void {
  if (!response.ok) throw new Error(`${message} (${response.status})`);
}

export interface AdminProductListFilters {
  page?: number;
  pageSize?: number;
  status?: string;
  categoryId?: string;
  stockLevel?: "in_stock" | "low_stock" | "out_of_stock";
  search?: string;
}

export interface AdminProductListRow {
  id: string;
  sku: string;
  name: string;
  status: string;
  inStock: boolean;
  stockQuantity: number;
  updatedAt: string;
  brand: { name: string } | null;
  categories: { name: string }[];
  images: { url: string; altText: string | null }[];
  standardPrices: { price: string; currency: string }[];
}

export interface AdminProductListResult {
  items: AdminProductListRow[];
  total: number;
}

function toQueryString(filters: AdminProductListFilters): string {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters.status) params.set("status", filters.status);
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
  if (filters.stockLevel) params.set("stockLevel", filters.stockLevel);
  if (filters.search) params.set("search", filters.search);
  return params.toString();
}

export async function fetchAdminProducts(filters: AdminProductListFilters): Promise<AdminProductListResult> {
  const response = await fetch(`/api/admin/products?${toQueryString(filters)}`);
  assertOk(response, "Failed to load products");
  return response.json();
}

export interface ReferenceDataResult {
  categories: { id: string; name: string; parentId: string | null }[];
  brands: { id: string; name: string }[];
  collections: { id: string; name: string }[];
  allergens: { id: string; name: string }[];
  certifications: { id: string; name: string }[];
}

export async function fetchProductFormReferenceData(): Promise<ReferenceDataResult> {
  const response = await fetch("/api/admin/products/reference-data");
  assertOk(response, "Failed to load reference data");
  return response.json();
}

export async function fetchAdminProduct(id: string) {
  const response = await fetch(`/api/admin/products/${id}`);
  assertOk(response, "Failed to load product");
  return response.json();
}

export async function createAdminProduct(input: ProductAdminFormInput) {
  const response = await fetch("/api/admin/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Failed to create product" }));
    throw new Error(body.error ?? "Failed to create product");
  }
  return response.json();
}

export async function updateAdminProduct(id: string, input: ProductAdminFormInput) {
  const response = await fetch(`/api/admin/products/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Failed to update product" }));
    throw new Error(body.error ?? "Failed to update product");
  }
  return response.json();
}

export async function deleteAdminProduct(id: string) {
  const response = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
  assertOk(response, "Failed to delete product");
}

export async function duplicateAdminProduct(id: string, newSlug: string, newSku: string) {
  const response = await fetch(`/api/admin/products/${id}/duplicate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newSlug, newSku }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Failed to duplicate product" }));
    throw new Error(body.error ?? "Failed to duplicate product");
  }
  return response.json();
}

export async function changeAdminProductStatus(id: string, status: string) {
  const response = await fetch(`/api/admin/products/${id}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  assertOk(response, "Failed to change product status");
  return response.json();
}

export interface BulkResult {
  succeeded: string[];
  failed: { id: string; reason: string }[];
}

export async function bulkChangeAdminProductStatus(ids: string[], status: string): Promise<BulkResult> {
  const response = await fetch("/api/admin/products/bulk-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, status }),
  });
  assertOk(response, "Failed to update products");
  return response.json();
}

export async function bulkDeleteAdminProducts(ids: string[]): Promise<BulkResult> {
  const response = await fetch("/api/admin/products/bulk-delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  assertOk(response, "Failed to delete products");
  return response.json();
}

// --- Pricing ---

export async function setStandardPrice(productId: string, price: number, currency: string) {
  const response = await fetch(`/api/admin/products/${productId}/pricing/standard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ price, currency }),
  });
  assertOk(response, "Failed to set standard price");
  return response.json();
}

export async function upsertSalePrice(productId: string, input: { id?: string; price: number; currency: string; startDate: string; endDate: string }) {
  const response = await fetch(`/api/admin/products/${productId}/pricing/sale`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  assertOk(response, "Failed to save sale price");
  return response.json();
}

export async function removeSalePrice(productId: string, priceId: string) {
  const response = await fetch(`/api/admin/products/${productId}/pricing/sale/${priceId}`, { method: "DELETE" });
  assertOk(response, "Failed to remove sale price");
}

export async function upsertCampaignPrice(
  productId: string,
  input: { id?: string; campaignId: string; price: number; currency: string; startDate: string; endDate: string },
) {
  const response = await fetch(`/api/admin/products/${productId}/pricing/campaign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  assertOk(response, "Failed to save campaign price");
  return response.json();
}

export async function removeCampaignPrice(productId: string, priceId: string) {
  const response = await fetch(`/api/admin/products/${productId}/pricing/campaign/${priceId}`, { method: "DELETE" });
  assertOk(response, "Failed to remove campaign price");
}

export async function setCustomerGroupPrice(productId: string, customerGroup: string, price: number, currency: string) {
  const response = await fetch(`/api/admin/products/${productId}/pricing/customer-group`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customerGroup, price, currency }),
  });
  assertOk(response, "Failed to set customer-group price");
  return response.json();
}

export async function upsertVolumeDiscountTier(
  productId: string,
  input: { id?: string; minQuantity: number; discountPrice?: number; discountPercent?: number; currency: string },
) {
  const response = await fetch(`/api/admin/products/${productId}/pricing/volume-discount`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  assertOk(response, "Failed to save volume discount tier");
  return response.json();
}

export async function removeVolumeDiscountTier(productId: string, tierId: string) {
  const response = await fetch(`/api/admin/products/${productId}/pricing/volume-discount/${tierId}`, { method: "DELETE" });
  assertOk(response, "Failed to remove volume discount tier");
}
