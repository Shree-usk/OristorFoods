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

// --- Variants ---

export interface VariantFormInput {
  sku: string;
  barcode?: string | null;
  name: string;
  netWeightGrams: number;
  price: number;
  promoPrice?: number | null;
  currency: string;
  inStock?: boolean;
  stockQuantity?: number;
  isActive?: boolean;
  sortOrder?: number;
  shippingWeightGrams?: number | null;
  lengthMm?: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
  fulfilmentRestriction?: "None" | "LocalOnly" | "ExportOnly" | "ManualApprovalRequired";
}

export async function createVariant(productId: string, input: VariantFormInput) {
  const response = await fetch(`/api/admin/products/${productId}/variants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) return readErrorOr(response, "Failed to create variant");
  return response.json();
}

export async function updateVariant(productId: string, variantId: string, input: VariantFormInput) {
  const response = await fetch(`/api/admin/products/${productId}/variants/${variantId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) return readErrorOr(response, "Failed to save variant");
  return response.json();
}

export async function deleteVariant(productId: string, variantId: string) {
  const response = await fetch(`/api/admin/products/${productId}/variants/${variantId}`, { method: "DELETE" });
  assertOk(response, "Failed to delete variant");
}

export async function setVariantImages(productId: string, variantId: string, images: { url: string; altText?: string | null; isPrimary?: boolean; sortOrder?: number }[]) {
  const response = await fetch(`/api/admin/products/${productId}/variants/${variantId}/images`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images }),
  });
  assertOk(response, "Failed to save variant images");
  return response.json();
}

// --- Bundles (Story 2) ---

export interface BundleFormInput {
  bundleType: "Fixed" | "Selectable" | "MixAndMatch";
  name: string;
  description?: string | null;
  status?: "Active" | "Inactive";
  startDate?: string | null;
  endDate?: string | null;
  discountType?: "FixedPrice" | "PercentageOff" | "FixedAmountOff" | null;
  fixedPrice?: number | null;
  percentOff?: number | null;
  amountOff?: number | null;
  minQuantity?: number | null;
  maxQuantity?: number | null;
  stockMode?: "Derived" | "OwnStock";
  stockQuantity?: number | null;
  inStock?: boolean;
}

export interface BundleItemFormInput {
  componentProductId: string;
  componentVariantId?: string | null;
  quantity: number;
  isRequired?: boolean;
  minQuantity?: number;
  maxQuantity?: number | null;
  sortOrder?: number;
}

async function readErrorOr(response: Response, fallbackMessage: string): Promise<never> {
  const body = await response.json().catch(() => ({ error: fallbackMessage }));
  throw new Error(body.error ?? fallbackMessage);
}

export async function fetchAdminBundle(productId: string) {
  const response = await fetch(`/api/admin/products/${productId}/bundle`);
  if (response.status === 404) return null;
  assertOk(response, "Failed to load bundle");
  return response.json();
}

export async function createAdminBundle(productId: string, input: BundleFormInput) {
  const response = await fetch(`/api/admin/products/${productId}/bundle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) return readErrorOr(response, "Failed to create bundle");
  return response.json();
}

export async function updateAdminBundle(productId: string, input: BundleFormInput) {
  const response = await fetch(`/api/admin/products/${productId}/bundle`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) return readErrorOr(response, "Failed to save bundle");
  return response.json();
}

export async function deleteAdminBundle(productId: string) {
  const response = await fetch(`/api/admin/products/${productId}/bundle`, { method: "DELETE" });
  assertOk(response, "Failed to delete bundle");
}

export async function addBundleItem(productId: string, input: BundleItemFormInput) {
  const response = await fetch(`/api/admin/products/${productId}/bundle/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) return readErrorOr(response, "Failed to add bundle item");
  return response.json();
}

export async function updateBundleItem(productId: string, itemId: string, input: BundleItemFormInput) {
  const response = await fetch(`/api/admin/products/${productId}/bundle/items/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) return readErrorOr(response, "Failed to save bundle item");
  return response.json();
}

export async function deleteBundleItem(productId: string, itemId: string) {
  const response = await fetch(`/api/admin/products/${productId}/bundle/items/${itemId}`, { method: "DELETE" });
  assertOk(response, "Failed to remove bundle item");
}

export async function setBundleImages(productId: string, images: { url: string; altText?: string | null; isPrimary?: boolean; sortOrder?: number }[]) {
  const response = await fetch(`/api/admin/products/${productId}/bundle/images`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images }),
  });
  assertOk(response, "Failed to save bundle images");
  return response.json();
}

export async function fetchBundlePreview(productId: string): Promise<{ standaloneTotal: string; discountedTotal: string; savings: string }> {
  const response = await fetch(`/api/admin/products/${productId}/bundle/preview`);
  assertOk(response, "Failed to load bundle price preview");
  return response.json();
}

// --- Custom packaging (Story 3) ---

export interface PackagingOptionFormInput {
  packagingMethodId: string;
  variantId?: string | null;
  chargeType?: "Fixed" | "PerGram";
  charge?: number;
  // Weight-based pricing (Story 3b) — only meaningful when chargeType is "PerGram".
  ratePerGram?: number | null;
  minOrderWeightGrams?: number | null;
  minPackagingCharge?: number | null;
  minQuantity?: number | null;
  availability?: "Local" | "Export" | "Both";
  requiresManualReview?: boolean;
  leadTimeDays?: number | null;
  shelfLifeDays?: number | null;
  shelfLifeText?: string | null;
  customerInstructions?: string | null;
  acknowledgementText?: string | null;
  availabilityStartDate?: string | null;
  availabilityEndDate?: string | null;
  orderCutoffDate?: string | null;
  status?: "Active" | "TemporarilyUnavailable" | "Discontinued";
  sortOrder?: number;
}

export interface AdminPackagingOption extends Omit<PackagingOptionFormInput, "charge" | "ratePerGram" | "minPackagingCharge"> {
  id: string;
  productId: string;
  // Prisma Decimal fields serialize to JSON as strings (Decimal's own
  // toJSON()) — same gotcha product-variants-panel.tsx's price field
  // already documents.
  charge: string | number;
  ratePerGram: string | number | null;
  minPackagingCharge: string | number | null;
  packagingMethod: { id: string; name: string };
  variant: { id: string; name: string } | null;
}

export async function fetchPackagingOptionsForProduct(productId: string): Promise<AdminPackagingOption[]> {
  const response = await fetch(`/api/admin/products/${productId}/packaging/options`);
  assertOk(response, "Failed to load packaging options");
  return response.json();
}

export async function createPackagingOption(productId: string, input: PackagingOptionFormInput) {
  const response = await fetch(`/api/admin/products/${productId}/packaging/options`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) return readErrorOr(response, "Failed to add packaging option");
  return response.json();
}

export async function updatePackagingOption(productId: string, optionId: string, input: PackagingOptionFormInput) {
  const response = await fetch(`/api/admin/products/${productId}/packaging/options/${optionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) return readErrorOr(response, "Failed to save packaging option");
  return response.json();
}

export async function deletePackagingOption(productId: string, optionId: string) {
  const response = await fetch(`/api/admin/products/${productId}/packaging/options/${optionId}`, { method: "DELETE" });
  assertOk(response, "Failed to remove packaging option");
}
