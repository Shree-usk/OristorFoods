import * as collectionRepository from "@/repositories/collection.repository";
import * as exportCatalogueSettingRepository from "@/repositories/export-catalogue-setting.repository";
import * as productRepository from "@/repositories/product.repository";
import type { ExportCatalogueAdminListFilters } from "@/repositories/product.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { renderExportCataloguePdf } from "@/services/export-catalogue-pdf.service";
import { requirePermission } from "@/services/permission.service";
import type { ExportCatalogueSettingInput } from "@/validation/export-catalogue-admin.schema";

/** Export & Wholesale page — public, no permission gate, same pattern as collection.service.ts::getFeaturedCollectionsForStorefront. */
export function getExportCollectionsForStorefront() {
  return collectionRepository.listCollectionsForExportPage();
}

const CATALOGUE_PAGE_SIZE = 24;
const MAX_CATALOGUE_PAGE_SIZE = 48;

export interface ExportCatalogueListingFilters {
  search?: string;
  collectionSlug?: string;
  page?: number;
  pageSize?: number;
}

/** Export & Wholesale catalogue — public, no permission gate. Visibility (Published + isExportEnabled) is hardcoded in the repository, never caller-supplied. */
export function listExportCatalogueProducts(filters: ExportCatalogueListingFilters) {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const pageSize = Math.min(filters.pageSize && filters.pageSize > 0 ? filters.pageSize : CATALOGUE_PAGE_SIZE, MAX_CATALOGUE_PAGE_SIZE);
  return productRepository.findExportCatalogueProducts({ search: filters.search, collectionSlug: filters.collectionSlug }, page, pageSize);
}

/**
 * Export & Wholesale catalogue PDF — public, no permission gate. Looks the
 * ids up through the same hardcoded Published+isExportEnabled visibility
 * rule as the listing above (findExportCatalogueProductsByIds), so a
 * stale or tampered id from a buyer's client-side selection can never
 * pull in an unpublished/export-disabled product; it's silently dropped.
 */
export async function generateExportCataloguePdf(productIds: string[]): Promise<Buffer> {
  const products = await productRepository.findExportCatalogueProductsByIds(productIds);
  return renderExportCataloguePdf(products);
}

// --- Admin: catalogue product management (gated ExportPortal, not Products — an Export Manager may not have Products access at all) ---

const ADMIN_CATALOGUE_PAGE_SIZE = 20;

export async function listExportCatalogueProductsForAdmin(adminUserId: string, filters: ExportCatalogueAdminListFilters, page: number) {
  await requirePermission(adminUserId, "ExportPortal", "View");
  return productRepository.listProductsForExportCatalogueAdmin(filters, page, ADMIN_CATALOGUE_PAGE_SIZE);
}

export interface BulkExportVisibilityResult {
  updatedCount: number;
}

export async function bulkSetExportVisibilityForAdmin(adminUserId: string, ids: string[], isExportEnabled: boolean): Promise<BulkExportVisibilityResult> {
  await requirePermission(adminUserId, "ExportPortal", "Edit");
  const result = await productRepository.bulkSetExportVisibility(ids, isExportEnabled);
  await writeAuditLog({
    actorId: adminUserId,
    action: isExportEnabled ? "export_catalogue_products_enabled" : "export_catalogue_products_disabled",
    module: "ExportPortal",
    targetType: "Product",
    metadata: { ids, count: result.count },
  });
  return { updatedCount: result.count };
}

// --- Admin: catalogue settings (gated ExportPortal) ---
// Deliberately doesn't duplicate CompanySetting's logo/contact fields —
// those are read live from system-settings.service.ts wherever the
// catalogue/PDF needs them.

export async function getExportCatalogueSettingForAdmin(adminUserId: string) {
  await requirePermission(adminUserId, "ExportPortal", "View");
  return exportCatalogueSettingRepository.getExportCatalogueSetting();
}

export async function updateExportCatalogueSettingForAdmin(adminUserId: string, input: ExportCatalogueSettingInput) {
  await requirePermission(adminUserId, "ExportPortal", "Edit");
  const setting = await exportCatalogueSettingRepository.upsertExportCatalogueSetting({
    title: input.title ?? null,
    introText: input.introText ?? null,
    showPricing: input.showPricing ?? false,
  });
  await writeAuditLog({ actorId: adminUserId, action: "export_catalogue_settings_updated", module: "ExportPortal", targetType: "ExportCatalogueSetting", targetId: "global" });
  return setting;
}
