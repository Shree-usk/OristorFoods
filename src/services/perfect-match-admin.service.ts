import { Prisma } from "@/generated/prisma/client";
import * as perfectMatchRepository from "@/repositories/perfect-match.repository";
import { findProductById } from "@/repositories/product.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { requirePermission } from "@/services/permission.service";
import {
  PerfectMatchPairingLimitExceededError,
  PerfectMatchPairingNotFoundError,
  PerfectMatchProductAlreadyAddedError,
  PerfectMatchProductNotFoundError,
  PerfectMatchUnderlyingProductNotFoundError,
} from "@/services/perfect-match-admin.errors";
import type { PerfectMatchPairingAdminInput, PerfectMatchProductAdminInput, PerfectMatchSettingAdminInput } from "@/validation/perfect-match-admin.schema";

/** Up to 4 Published pairings per product on the homepage experience. */
const MAX_PUBLISHED_PAIRINGS_PER_PRODUCT = 4;

/**
 * PerfectMatchProduct.productId is @unique and `product` is a one-to-one
 * relation back to Product.perfectMatchEntry — connecting an
 * already-linked product via `product: { connect: { id } } }` fails as
 * P2014 ("required relation violation"), not the classic P2002 unique-
 * constraint code a plain scalar `@unique` column would raise.
 */
function isDuplicateProductLinkError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2014");
}

async function requirePerfectMatchProduct(id: string) {
  const product = await perfectMatchRepository.findPerfectMatchProductById(id);
  if (!product) throw new PerfectMatchProductNotFoundError();
  return product;
}

async function requirePerfectMatchPairing(id: string) {
  const pairing = await perfectMatchRepository.findPerfectMatchPairingById(id);
  if (!pairing) throw new PerfectMatchPairingNotFoundError();
  return pairing;
}

/** Called whenever a pairing is about to become Published — counts every OTHER currently-Published pairing on the same product, so updating an already-Published pairing (changing its copy, not its status) never double-counts itself. */
async function assertPairingLimitNotExceeded(perfectMatchProductId: string, excludePairingId?: string): Promise<void> {
  const publishedCount = await perfectMatchRepository.countPublishedPerfectMatchPairings(perfectMatchProductId);
  const alreadyCountsExcluded = excludePairingId ? (await perfectMatchRepository.findPerfectMatchPairingById(excludePairingId))?.status === "Published" : false;
  const effectiveCount = alreadyCountsExcluded ? publishedCount - 1 : publishedCount;
  if (effectiveCount >= MAX_PUBLISHED_PAIRINGS_PER_PRODUCT) throw new PerfectMatchPairingLimitExceededError();
}

// --- Section intro copy ---

export async function getPerfectMatchSettingForAdmin(adminUserId: string) {
  await requirePermission(adminUserId, "PerfectMatch", "View");
  return perfectMatchRepository.getPerfectMatchSetting();
}

export async function updatePerfectMatchSettingForAdmin(adminUserId: string, input: PerfectMatchSettingAdminInput) {
  await requirePermission(adminUserId, "PerfectMatch", "Edit");
  const updated = await perfectMatchRepository.upsertPerfectMatchSetting(input);
  await writeAuditLog({ actorId: adminUserId, action: "perfect_match_settings_updated", module: "PerfectMatch", targetType: "PerfectMatchSetting", targetId: "global" });
  return updated;
}

// --- Products ---

export async function listPerfectMatchProductsForAdmin(adminUserId: string) {
  await requirePermission(adminUserId, "PerfectMatch", "View");
  return perfectMatchRepository.listPerfectMatchProducts();
}

export async function getPerfectMatchProductForAdmin(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "PerfectMatch", "View");
  return requirePerfectMatchProduct(id);
}

export async function addPerfectMatchProduct(adminUserId: string, input: PerfectMatchProductAdminInput) {
  await requirePermission(adminUserId, "PerfectMatch", "Edit");
  const underlyingProduct = await findProductById(input.productId);
  if (!underlyingProduct) throw new PerfectMatchUnderlyingProductNotFoundError();

  const sortOrder = await perfectMatchRepository.nextPerfectMatchProductSortOrder();
  try {
    const created = await perfectMatchRepository.createPerfectMatchProduct({
      product: { connect: { id: input.productId } },
      kicker: input.kicker,
      promoDescriptionOverride: input.promoDescriptionOverride,
      sortOrder,
    });
    if (input.isDefaultFeatured) {
      await perfectMatchRepository.clearOtherDefaultFeaturedProducts(created.id);
      await perfectMatchRepository.updatePerfectMatchProduct(created.id, { isDefaultFeatured: true });
    }
    await writeAuditLog({ actorId: adminUserId, action: "perfect_match_product_added", module: "PerfectMatch", targetType: "PerfectMatchProduct", targetId: created.id });
    return requirePerfectMatchProduct(created.id);
  } catch (error) {
    if (isDuplicateProductLinkError(error)) throw new PerfectMatchProductAlreadyAddedError();
    throw error;
  }
}

export async function updatePerfectMatchProductAdmin(adminUserId: string, id: string, input: PerfectMatchProductAdminInput) {
  await requirePermission(adminUserId, "PerfectMatch", "Edit");
  await requirePerfectMatchProduct(id);

  if (input.isDefaultFeatured) await perfectMatchRepository.clearOtherDefaultFeaturedProducts(id);
  await perfectMatchRepository.updatePerfectMatchProduct(id, {
    kicker: input.kicker,
    promoDescriptionOverride: input.promoDescriptionOverride,
    isDefaultFeatured: input.isDefaultFeatured,
    status: input.status,
  });
  await writeAuditLog({ actorId: adminUserId, action: "perfect_match_product_updated", module: "PerfectMatch", targetType: "PerfectMatchProduct", targetId: id });
  return requirePerfectMatchProduct(id);
}

export async function removePerfectMatchProduct(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "PerfectMatch", "Delete");
  await requirePerfectMatchProduct(id);
  await perfectMatchRepository.deletePerfectMatchProductById(id);
  await writeAuditLog({ actorId: adminUserId, action: "perfect_match_product_removed", module: "PerfectMatch", targetType: "PerfectMatchProduct", targetId: id });
}

export async function reorderPerfectMatchProductsAdmin(adminUserId: string, orderedIds: string[]) {
  await requirePermission(adminUserId, "PerfectMatch", "Edit");
  await perfectMatchRepository.reorderPerfectMatchProducts(orderedIds);
  await writeAuditLog({ actorId: adminUserId, action: "perfect_match_products_reordered", module: "PerfectMatch", targetType: "PerfectMatchProduct" });
}

// --- Meal-pairing cards ---

export async function listPerfectMatchPairingsForAdmin(adminUserId: string, perfectMatchProductId: string) {
  await requirePermission(adminUserId, "PerfectMatch", "View");
  await requirePerfectMatchProduct(perfectMatchProductId);
  return perfectMatchRepository.listPerfectMatchPairingsByProduct(perfectMatchProductId);
}

export async function addPerfectMatchPairing(adminUserId: string, perfectMatchProductId: string, input: PerfectMatchPairingAdminInput) {
  await requirePermission(adminUserId, "PerfectMatch", "Edit");
  await requirePerfectMatchProduct(perfectMatchProductId);
  if (input.status === "Published") await assertPairingLimitNotExceeded(perfectMatchProductId);

  const sortOrder = await perfectMatchRepository.nextPerfectMatchPairingSortOrder(perfectMatchProductId);
  const created = await perfectMatchRepository.createPerfectMatchPairing({
    perfectMatchProduct: { connect: { id: perfectMatchProductId } },
    title: input.title,
    description: input.description,
    imageUrl: input.imageUrl,
    imageAlt: input.imageAlt,
    categoryLabel: input.categoryLabel,
    supportingTag: input.supportingTag,
    status: input.status,
    sortOrder,
  });
  await writeAuditLog({ actorId: adminUserId, action: "perfect_match_pairing_added", module: "PerfectMatch", targetType: "PerfectMatchPairing", targetId: created.id });
  return created;
}

export async function updatePerfectMatchPairingAdmin(adminUserId: string, id: string, input: PerfectMatchPairingAdminInput) {
  await requirePermission(adminUserId, "PerfectMatch", "Edit");
  const pairing = await requirePerfectMatchPairing(id);
  if (input.status === "Published") await assertPairingLimitNotExceeded(pairing.perfectMatchProductId, id);

  const updated = await perfectMatchRepository.updatePerfectMatchPairing(id, {
    title: input.title,
    description: input.description,
    imageUrl: input.imageUrl,
    imageAlt: input.imageAlt,
    categoryLabel: input.categoryLabel,
    supportingTag: input.supportingTag,
    status: input.status,
  });
  await writeAuditLog({ actorId: adminUserId, action: "perfect_match_pairing_updated", module: "PerfectMatch", targetType: "PerfectMatchPairing", targetId: id });
  return updated;
}

export async function removePerfectMatchPairing(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "PerfectMatch", "Delete");
  await requirePerfectMatchPairing(id);
  await perfectMatchRepository.deletePerfectMatchPairingById(id);
  await writeAuditLog({ actorId: adminUserId, action: "perfect_match_pairing_removed", module: "PerfectMatch", targetType: "PerfectMatchPairing", targetId: id });
}

/** Rejects any id in orderedIds that doesn't belong to this product, so a stray/stale id can't silently reorder another product's pairings — same defense-in-depth FoodAcademy's featured-reorder uses. */
export async function reorderPerfectMatchPairingsAdmin(adminUserId: string, perfectMatchProductId: string, orderedIds: string[]) {
  await requirePermission(adminUserId, "PerfectMatch", "Edit");
  const ownPairings = await perfectMatchRepository.listPerfectMatchPairingsByProduct(perfectMatchProductId);
  const ownIds = new Set(ownPairings.map((p) => p.id));
  for (const id of orderedIds) {
    if (!ownIds.has(id)) throw new PerfectMatchPairingNotFoundError();
  }
  await perfectMatchRepository.reorderPerfectMatchPairings(orderedIds);
  await writeAuditLog({ actorId: adminUserId, action: "perfect_match_pairings_reordered", module: "PerfectMatch", targetType: "PerfectMatchPairing" });
}
