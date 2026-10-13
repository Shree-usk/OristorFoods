import * as packagingRepository from "@/repositories/packaging.repository";
import * as productVariantRepository from "@/repositories/product-variant.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { requirePermission } from "@/services/permission.service";
import {
  PackagingMethodNameConflictError,
  PackagingMethodNotFoundError,
  PackagingOptionDuplicateError,
  PackagingOptionNotFoundError,
  PackagingOptionVariantMismatchError,
} from "@/services/product-admin.errors";
import type { PackagingMethodAdminFormInput, ProductPackagingOptionAdminFormInput } from "@/validation/packaging-admin.schema";

/**
 * Admin writes for both PackagingMethod (global) and ProductPackagingOption
 * (per-product) — Story 3 (Custom Packaging). One file covers both,
 * mirroring product-taxonomy.service.ts's "one small file covers two
 * tightly-related concepts" precedent: these are two independently-
 * addressed resources (one global list screen, one per-product nested
 * screen) that share identical permission/audit-log shape and are always
 * touched in the same admin session.
 */

// --- PackagingMethod (global) ---

export async function listPackagingMethods(adminUserId: string) {
  await requirePermission(adminUserId, "Products", "View");
  return packagingRepository.listAllPackagingMethodsForAdmin();
}

export async function createPackagingMethod(adminUserId: string, input: PackagingMethodAdminFormInput) {
  await requirePermission(adminUserId, "Products", "Edit");
  const existing = await packagingRepository.findPackagingMethodByName(input.name);
  if (existing) throw new PackagingMethodNameConflictError(input.name);

  const method = await packagingRepository.createPackagingMethod({
    name: input.name,
    description: input.description ?? null,
    image: input.image ?? null,
    status: input.status ?? "Active",
  });
  await writeAuditLog({ actorId: adminUserId, action: "packaging_method_created", module: "Products", targetType: "PackagingMethod", targetId: method.id });
  return method;
}

export async function updatePackagingMethod(adminUserId: string, id: string, input: PackagingMethodAdminFormInput) {
  await requirePermission(adminUserId, "Products", "Edit");
  const existing = await packagingRepository.findPackagingMethodById(id);
  if (!existing) throw new PackagingMethodNotFoundError();
  const conflict = await packagingRepository.findPackagingMethodByName(input.name);
  if (conflict && conflict.id !== id) throw new PackagingMethodNameConflictError(input.name);

  const method = await packagingRepository.updatePackagingMethod(id, {
    name: input.name,
    description: input.description ?? null,
    image: input.image ?? null,
    status: input.status ?? "Active",
  });
  await writeAuditLog({ actorId: adminUserId, action: "packaging_method_updated", module: "Products", targetType: "PackagingMethod", targetId: id });
  return method;
}

// --- ProductPackagingOption (per-product) ---

export async function listPackagingOptionsForProduct(adminUserId: string, productId: string) {
  await requirePermission(adminUserId, "Products", "View");
  return packagingRepository.findPackagingOptionsForProduct(productId);
}

async function requireVariantBelongsToProduct(productId: string, variantId: string | null | undefined) {
  if (!variantId) return;
  const variant = await productVariantRepository.findVariantById(variantId);
  if (!variant || variant.productId !== productId) throw new PackagingOptionVariantMismatchError();
}

async function requireNoDuplicateOption(productId: string, variantId: string | null | undefined, packagingMethodId: string, excludeId?: string) {
  const duplicate = await packagingRepository.findDuplicatePackagingOption(productId, variantId ?? null, packagingMethodId, excludeId);
  if (duplicate) throw new PackagingOptionDuplicateError();
}

function toOptionData(input: ProductPackagingOptionAdminFormInput) {
  return {
    charge: input.charge ?? 0,
    minQuantity: input.minQuantity ?? null,
    availability: input.availability ?? "Both",
    requiresManualReview: input.requiresManualReview ?? false,
    leadTimeDays: input.leadTimeDays ?? null,
    shelfLifeDays: input.shelfLifeDays ?? null,
    shelfLifeText: input.shelfLifeText ?? null,
    customerInstructions: input.customerInstructions ?? null,
    acknowledgementText: input.acknowledgementText ?? null,
    availabilityStartDate: input.availabilityStartDate ?? null,
    availabilityEndDate: input.availabilityEndDate ?? null,
    orderCutoffDate: input.orderCutoffDate ?? null,
    status: input.status ?? "Active",
    sortOrder: input.sortOrder ?? 0,
  };
}

export async function createPackagingOption(adminUserId: string, productId: string, input: ProductPackagingOptionAdminFormInput) {
  await requirePermission(adminUserId, "Products", "Edit");
  await requireVariantBelongsToProduct(productId, input.variantId);
  await requireNoDuplicateOption(productId, input.variantId, input.packagingMethodId);

  const option = await packagingRepository.createPackagingOption({
    product: { connect: { id: productId } },
    variant: input.variantId ? { connect: { id: input.variantId } } : undefined,
    packagingMethod: { connect: { id: input.packagingMethodId } },
    ...toOptionData(input),
  });
  await writeAuditLog({ actorId: adminUserId, action: "packaging_option_created", module: "Products", targetType: "Product", targetId: productId, metadata: { packagingOptionId: option.id } });
  return option;
}

async function requirePackagingOptionForProduct(productId: string, optionId: string) {
  const option = await packagingRepository.findPackagingOptionById(optionId);
  if (!option || option.productId !== productId) throw new PackagingOptionNotFoundError();
  return option;
}

export async function updatePackagingOption(adminUserId: string, productId: string, optionId: string, input: ProductPackagingOptionAdminFormInput) {
  await requirePermission(adminUserId, "Products", "Edit");
  await requirePackagingOptionForProduct(productId, optionId);
  await requireVariantBelongsToProduct(productId, input.variantId);
  await requireNoDuplicateOption(productId, input.variantId, input.packagingMethodId, optionId);

  const option = await packagingRepository.updatePackagingOption(optionId, {
    variant: input.variantId ? { connect: { id: input.variantId } } : { disconnect: true },
    packagingMethod: { connect: { id: input.packagingMethodId } },
    ...toOptionData(input),
  });
  await writeAuditLog({ actorId: adminUserId, action: "packaging_option_updated", module: "Products", targetType: "Product", targetId: productId, metadata: { packagingOptionId: optionId } });
  return option;
}

export async function deletePackagingOption(adminUserId: string, productId: string, optionId: string) {
  await requirePermission(adminUserId, "Products", "Delete");
  await requirePackagingOptionForProduct(productId, optionId);

  await packagingRepository.deletePackagingOption(optionId);
  await writeAuditLog({ actorId: adminUserId, action: "packaging_option_deleted", module: "Products", targetType: "Product", targetId: productId, metadata: { packagingOptionId: optionId } });
}
