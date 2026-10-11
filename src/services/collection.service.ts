import type { CollectionAdminFormInput } from "@/validation/collection-admin.schema";
import * as collectionRepository from "@/repositories/collection.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { CollectionNotFoundError, CollectionSlugConflictError } from "@/services/collection.errors";
import { requirePermission } from "@/services/permission.service";

export async function getPublishedCollectionBySlug(slug: string, date: Date = new Date()) {
  const collection = await collectionRepository.findCollectionBySlug(slug);
  if (!collection || collection.status !== "Active") return null;
  if (collection.startDate && date < collection.startDate) return null;
  if (collection.endDate && date > collection.endDate) return null;
  return collection;
}

/** Homepage "Product Collections" — public, no permission gate, same pattern as category.service.ts::getFeaturedCategoriesForStorefront. */
export function getFeaturedCollectionsForStorefront(limit: number) {
  return collectionRepository.listFeaturedCollections(limit);
}

// --- Admin (Products module — collections are product reference data, same as Category/Brand) ---

export async function listCollectionsForAdmin(adminUserId: string) {
  await requirePermission(adminUserId, "Products", "View");
  return collectionRepository.listAllCollectionsForAdmin();
}

/** Clears a blank string back to a real SQL NULL rather than storing "" — keeps listFeaturedCollections' `image: { not: null }` filter meaningful. */
function nullIfBlank(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value === null || value.trim() === "" ? null : value;
}

/** Same blank-to-null rule as nullIfBlank, but parses a non-blank date <input> string ("YYYY-MM-DD") into a Date for Prisma. */
function dateOrNull(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  return value === null || value.trim() === "" ? null : new Date(value);
}

async function assertNoSlugConflict(slug: string, excludeId?: string): Promise<void> {
  const existing = await collectionRepository.findCollectionBySlug(slug);
  if (existing && existing.id !== excludeId) throw new CollectionSlugConflictError();
}

export async function createCollectionAdmin(adminUserId: string, input: CollectionAdminFormInput) {
  await requirePermission(adminUserId, "Products", "Edit");
  await assertNoSlugConflict(input.slug);

  const collection = await collectionRepository.createCollection({
    name: input.name,
    slug: input.slug,
    description: nullIfBlank(input.description) ?? null,
    image: nullIfBlank(input.image) ?? null,
    status: input.status ?? "Active",
    startDate: dateOrNull(input.startDate) ?? null,
    endDate: dateOrNull(input.endDate) ?? null,
    metaTitle: nullIfBlank(input.metaTitle) ?? null,
    metaDescription: nullIfBlank(input.metaDescription) ?? null,
    canonicalUrl: nullIfBlank(input.canonicalUrl) ?? null,
    ogImage: nullIfBlank(input.ogImage) ?? null,
  });
  await writeAuditLog({ actorId: adminUserId, action: "collection_created", module: "Products", targetType: "Collection", targetId: collection.id });
  return collection;
}

export async function updateCollectionAdmin(adminUserId: string, id: string, input: Partial<CollectionAdminFormInput>) {
  await requirePermission(adminUserId, "Products", "Edit");
  const existing = await collectionRepository.findCollectionById(id);
  if (!existing) throw new CollectionNotFoundError();
  if (input.slug) await assertNoSlugConflict(input.slug, id);

  const collection = await collectionRepository.updateCollection(id, {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.slug !== undefined && { slug: input.slug }),
    ...(input.description !== undefined && { description: nullIfBlank(input.description) }),
    ...(input.image !== undefined && { image: nullIfBlank(input.image) }),
    ...(input.status !== undefined && { status: input.status }),
    ...(input.startDate !== undefined && { startDate: dateOrNull(input.startDate) }),
    ...(input.endDate !== undefined && { endDate: dateOrNull(input.endDate) }),
    ...(input.metaTitle !== undefined && { metaTitle: nullIfBlank(input.metaTitle) }),
    ...(input.metaDescription !== undefined && { metaDescription: nullIfBlank(input.metaDescription) }),
    ...(input.canonicalUrl !== undefined && { canonicalUrl: nullIfBlank(input.canonicalUrl) }),
    ...(input.ogImage !== undefined && { ogImage: nullIfBlank(input.ogImage) }),
  });
  await writeAuditLog({ actorId: adminUserId, action: "collection_updated", module: "Products", targetType: "Collection", targetId: id });
  return collection;
}
