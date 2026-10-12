import { Prisma } from "@/generated/prisma/client";
import * as bundleRepository from "@/repositories/bundle.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { computeBundleDiscountedTotal } from "@/services/bundle-pricing.service";
import { requirePermission } from "@/services/permission.service";
import { resolvePrice } from "@/services/pricing.service";
import {
  BundleAlreadyExistsError,
  BundleItemNotFoundError,
  BundleNotFoundError,
} from "@/services/product-admin.errors";
import { resolveVariantPrice } from "@/services/product-variant.service";
import type { BundleAdminFormInput, BundleItemFormInput } from "@/validation/product-admin.schema";

/**
 * Admin write path for ProductBundle/BundleItem/BundleImage (Story 2 —
 * Bundles). Own file (unlike variants, which live inside
 * product-admin.service.ts) per the approved plan — same
 * "requirePermission + audit log, always" shape every admin module
 * follows (`.claude/skills/admin-console-module/SKILL.md`), mirroring the
 * variant functions' own CRUD shape one-for-one.
 */

function isUniqueConstraintViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function isRelationViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2014";
}

/**
 * Same adapter-shape gotcha product-admin.service.ts's own copy
 * documents — @prisma/adapter-pg reports the violated field under a
 * different path than Prisma's docs describe. ADDITIONALLY (found while
 * building this story, against `productId`): the adapter echoes the raw
 * Postgres constraint-detail text, which keeps the column name
 * double-quoted whenever Postgres itself needed to quote it in that text
 * — i.e. any column with an uppercase letter (`productId`), never an
 * all-lowercase one (`slug`/`sku`). Strip surrounding quotes so both
 * cases compare equal to a plain field name.
 */
function conflictField(error: Prisma.PrismaClientKnownRequestError): string | undefined {
  const meta = error.meta as { target?: unknown; driverAdapterError?: { cause?: { constraint?: { fields?: unknown } } } } | undefined;
  const adapterFields = meta?.driverAdapterError?.cause?.constraint?.fields;
  if (Array.isArray(adapterFields) && typeof adapterFields[0] === "string") return adapterFields[0].replace(/^"|"$/g, "");
  const target = meta?.target;
  if (Array.isArray(target)) return target[0] as string;
  if (typeof target === "string") return target;
  return undefined;
}

function toBundleData(input: BundleAdminFormInput) {
  return {
    bundleType: input.bundleType,
    name: input.name,
    description: input.description ?? null,
    status: input.status ?? "Active",
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    discountType: input.discountType ?? null,
    fixedPrice: input.discountType === "FixedPrice" ? input.fixedPrice : null,
    percentOff: input.discountType === "PercentageOff" ? input.percentOff : null,
    amountOff: input.discountType === "FixedAmountOff" ? input.amountOff : null,
    minQuantity: input.bundleType === "Fixed" ? null : (input.minQuantity ?? null),
    maxQuantity: input.bundleType === "Fixed" ? null : (input.maxQuantity ?? null),
    stockMode: input.stockMode ?? "Derived",
    stockQuantity: input.stockMode === "OwnStock" ? (input.stockQuantity ?? 0) : null,
    inStock: input.inStock ?? true,
  };
}

export async function getBundle(adminUserId: string, productId: string) {
  await requirePermission(adminUserId, "Products", "View");
  return bundleRepository.findBundleByProductId(productId);
}

export async function createBundle(adminUserId: string, productId: string, input: BundleAdminFormInput) {
  await requirePermission(adminUserId, "Products", "Edit");
  try {
    const bundle = await bundleRepository.createBundle({ ...toBundleData(input), product: { connect: { id: productId } } });
    await writeAuditLog({ actorId: adminUserId, action: "product_bundle_created", module: "Products", targetType: "Product", targetId: productId, metadata: { bundleId: bundle.id } });
    return bundle;
  } catch (error) {
    if (isUniqueConstraintViolation(error) && conflictField(error) === "productId") throw new BundleAlreadyExistsError();
    // A 1:1 relation's `connect` (Product.bundle / ProductBundle.productId)
    // fails this way, not with a P2002 — Prisma's query engine checks the
    // relation's cardinality itself before the DB-level unique constraint
    // ever gets a chance to fire. Confirmed by direct reproduction while
    // building this story; plain scalar `@unique` fields (slug/sku/
    // barcode) go through the P2002 path above instead.
    if (isRelationViolation(error)) throw new BundleAlreadyExistsError();
    throw error;
  }
}

async function requireBundleForProduct(productId: string) {
  const existing = await bundleRepository.findBundleByProductId(productId);
  if (!existing) throw new BundleNotFoundError();
  return existing;
}

export async function updateBundle(adminUserId: string, productId: string, input: BundleAdminFormInput) {
  await requirePermission(adminUserId, "Products", "Edit");
  const existing = await requireBundleForProduct(productId);

  const bundle = await bundleRepository.updateBundle(existing.id, toBundleData(input));
  await writeAuditLog({ actorId: adminUserId, action: "product_bundle_updated", module: "Products", targetType: "Product", targetId: productId, metadata: { bundleId: bundle.id } });
  return bundle;
}

export async function deleteBundle(adminUserId: string, productId: string) {
  await requirePermission(adminUserId, "Products", "Delete");
  const existing = await requireBundleForProduct(productId);

  await bundleRepository.deleteBundle(existing.id);
  await writeAuditLog({ actorId: adminUserId, action: "product_bundle_deleted", module: "Products", targetType: "Product", targetId: productId, metadata: { bundleId: existing.id } });
}

export async function addBundleItem(adminUserId: string, productId: string, input: BundleItemFormInput) {
  await requirePermission(adminUserId, "Products", "Edit");
  const bundle = await requireBundleForProduct(productId);

  const item = await bundleRepository.createBundleItem({
    bundle: { connect: { id: bundle.id } },
    componentProduct: { connect: { id: input.componentProductId } },
    componentVariant: input.componentVariantId ? { connect: { id: input.componentVariantId } } : undefined,
    quantity: input.quantity,
    isRequired: input.isRequired ?? (bundle.bundleType === "Fixed"),
    minQuantity: input.minQuantity ?? 0,
    maxQuantity: input.maxQuantity ?? null,
    sortOrder: input.sortOrder ?? 0,
  });
  await writeAuditLog({ actorId: adminUserId, action: "product_bundle_updated", module: "Products", targetType: "Product", targetId: productId, metadata: { bundleId: bundle.id, itemAdded: item.id } });
  return item;
}

async function requireBundleItemForProduct(productId: string, itemId: string) {
  const bundle = await requireBundleForProduct(productId);
  const item = await bundleRepository.findBundleItemById(itemId);
  if (!item || item.bundleId !== bundle.id) throw new BundleItemNotFoundError();
  return { bundle, item };
}

export async function updateBundleItem(adminUserId: string, productId: string, itemId: string, input: BundleItemFormInput) {
  await requirePermission(adminUserId, "Products", "Edit");
  const { bundle } = await requireBundleItemForProduct(productId, itemId);

  const item = await bundleRepository.updateBundleItem(itemId, {
    componentProduct: { connect: { id: input.componentProductId } },
    componentVariant: input.componentVariantId ? { connect: { id: input.componentVariantId } } : { disconnect: true },
    quantity: input.quantity,
    isRequired: input.isRequired ?? (bundle.bundleType === "Fixed"),
    minQuantity: input.minQuantity ?? 0,
    maxQuantity: input.maxQuantity ?? null,
    sortOrder: input.sortOrder ?? 0,
  });
  await writeAuditLog({ actorId: adminUserId, action: "product_bundle_updated", module: "Products", targetType: "Product", targetId: productId, metadata: { bundleId: bundle.id, itemUpdated: itemId } });
  return item;
}

export async function deleteBundleItem(adminUserId: string, productId: string, itemId: string) {
  await requirePermission(adminUserId, "Products", "Edit");
  const { bundle } = await requireBundleItemForProduct(productId, itemId);

  await bundleRepository.deleteBundleItem(itemId);
  await writeAuditLog({ actorId: adminUserId, action: "product_bundle_updated", module: "Products", targetType: "Product", targetId: productId, metadata: { bundleId: bundle.id, itemDeleted: itemId } });
}

/**
 * Numeric "original price / bundle price / savings" preview for the
 * admin panel — the ship-now slice of the brief's "preview as a customer
 * would see it" requirement (the full visual preview is deferred to the
 * Story 5 integration pass, see the approved plan). Reuses the exact
 * same pricing math a real add-to-cart would run (resolvePrice/
 * resolveVariantPrice + computeBundleDiscountedTotal) so this number can
 * never drift from what the customer actually pays.
 */
export async function previewBundlePricing(adminUserId: string, productId: string) {
  await requirePermission(adminUserId, "Products", "View");
  const bundle = await requireBundleForProduct(productId);

  const requiredItems = bundle.bundleType === "Fixed" ? bundle.items.filter((item) => item.isRequired) : bundle.items;
  let standaloneTotal = new Prisma.Decimal(0);
  for (const item of requiredItems) {
    const unitPrice = item.componentVariant
      ? new Prisma.Decimal(resolveVariantPrice(item.componentVariant).price)
      : (await resolvePrice({ productId: item.componentProductId }))?.price ?? new Prisma.Decimal(0);
    standaloneTotal = standaloneTotal.plus(unitPrice.times(item.quantity));
  }

  const discountedTotal = computeBundleDiscountedTotal(standaloneTotal, bundle);
  return {
    standaloneTotal: standaloneTotal.toFixed(2),
    discountedTotal: discountedTotal.toFixed(2),
    savings: standaloneTotal.minus(discountedTotal).toFixed(2),
  };
}

export async function setBundleImages(adminUserId: string, productId: string, images: { url: string; altText?: string | null; isPrimary?: boolean; sortOrder?: number }[]) {
  await requirePermission(adminUserId, "Products", "Edit");
  const existing = await requireBundleForProduct(productId);

  await bundleRepository.setBundleImages(existing.id, images);
  await writeAuditLog({ actorId: adminUserId, action: "product_bundle_updated", module: "Products", targetType: "Product", targetId: productId, metadata: { bundleId: existing.id, imagesUpdated: true } });
  return bundleRepository.findBundleById(existing.id);
}
