import { Prisma } from "@/generated/prisma/client";
import * as foodAcademyRepository from "@/repositories/food-academy.repository";
import type {
  FoodAcademyCategoryAdminRow,
  FoodAcademyCategoryAdminWriteInput,
  FoodAcademyEntryAdminDetail,
  FoodAcademyEntryAdminListFilters,
  FoodAcademyEntryAdminWriteInput,
} from "@/repositories/food-academy.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { requirePermission } from "@/services/permission.service";
import {
  FoodAcademyCategoryInUseError,
  FoodAcademyCategoryNotFoundError,
  FoodAcademyCategorySlugConflictError,
  FoodAcademyCourseRequiresSectionsError,
  FoodAcademyEntryNotFoundError,
  FoodAcademyEntryPublishReadinessError,
  FoodAcademyEntrySlugConflictError,
} from "@/services/food-academy-admin.errors";

function isUniqueConstraintViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Mirrors recipe-admin.service.ts's conflictField — the @prisma/adapter-pg driver reports a P2002's violated column(s) under meta.driverAdapterError.cause.constraint.fields, not the classic meta.target shape. */
function conflictField(error: Prisma.PrismaClientKnownRequestError): string | undefined {
  const meta = error.meta as { target?: unknown; driverAdapterError?: { cause?: { constraint?: { fields?: unknown } } } } | undefined;
  const adapterFields = meta?.driverAdapterError?.cause?.constraint?.fields;
  if (Array.isArray(adapterFields) && typeof adapterFields[0] === "string") return adapterFields[0];
  const target = meta?.target;
  if (Array.isArray(target)) return target[0] as string;
  if (typeof target === "string") return target;
  return undefined;
}

async function requireCategory(id: string): Promise<FoodAcademyCategoryAdminRow> {
  const category = await foodAcademyRepository.findFoodAcademyCategoryByIdForAdmin(id);
  if (!category) throw new FoodAcademyCategoryNotFoundError();
  return category;
}

async function requireEntry(id: string): Promise<FoodAcademyEntryAdminDetail> {
  const entry = await foodAcademyRepository.findFoodAcademyEntryAdminDetailById(id);
  if (!entry) throw new FoodAcademyEntryNotFoundError();
  return entry;
}

function assertPublishReady(entry: Pick<FoodAcademyEntryAdminDetail, "heroImageUrl" | "summary" | "contentType" | "sections">): void {
  const missing: string[] = [];
  if (!entry.heroImageUrl) missing.push("a hero image");
  if (!entry.summary) missing.push("a summary");
  if (entry.contentType === "Course" && entry.sections.length === 0) missing.push("at least one section");
  if (missing.length > 0) throw new FoodAcademyEntryPublishReadinessError(missing);
}

// --- Categories ---

export async function listFoodAcademyCategoriesForAdmin(adminUserId: string) {
  await requirePermission(adminUserId, "FoodAcademy", "View");
  return foodAcademyRepository.listAllFoodAcademyCategoriesForAdmin();
}

export async function getFoodAcademyCategoryForAdmin(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "FoodAcademy", "View");
  return requireCategory(id);
}

export async function createFoodAcademyCategory(adminUserId: string, input: FoodAcademyCategoryAdminWriteInput) {
  await requirePermission(adminUserId, "FoodAcademy", "Edit");
  try {
    const created = await foodAcademyRepository.createFoodAcademyCategoryAdmin(input);
    await writeAuditLog({ actorId: adminUserId, action: "food_academy_category_created", module: "FoodAcademy", targetType: "FoodAcademyCategory", targetId: created.id });
    return created;
  } catch (error) {
    if (isUniqueConstraintViolation(error) && conflictField(error) === "slug") throw new FoodAcademyCategorySlugConflictError(input.slug);
    throw error;
  }
}

export async function updateFoodAcademyCategory(adminUserId: string, id: string, input: FoodAcademyCategoryAdminWriteInput) {
  await requirePermission(adminUserId, "FoodAcademy", "Edit");
  await requireCategory(id);
  try {
    const updated = await foodAcademyRepository.updateFoodAcademyCategoryAdmin(id, input);
    await writeAuditLog({ actorId: adminUserId, action: "food_academy_category_updated", module: "FoodAcademy", targetType: "FoodAcademyCategory", targetId: id });
    return updated;
  } catch (error) {
    if (isUniqueConstraintViolation(error) && conflictField(error) === "slug") throw new FoodAcademyCategorySlugConflictError(input.slug);
    throw error;
  }
}

export async function deleteFoodAcademyCategory(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "FoodAcademy", "Delete");
  const category = await requireCategory(id);
  if (category._count.entries > 0) throw new FoodAcademyCategoryInUseError();
  await foodAcademyRepository.deleteFoodAcademyCategoryById(id);
  await writeAuditLog({ actorId: adminUserId, action: "food_academy_category_deleted", module: "FoodAcademy", targetType: "FoodAcademyCategory", targetId: id });
}

export async function reorderFoodAcademyCategories(adminUserId: string, orderedIds: string[]) {
  await requirePermission(adminUserId, "FoodAcademy", "Edit");
  await foodAcademyRepository.reorderFoodAcademyCategories(orderedIds);
  await writeAuditLog({ actorId: adminUserId, action: "food_academy_categories_reordered", module: "FoodAcademy", targetType: "FoodAcademyCategory" });
}

// --- Entries ---

export async function getFoodAcademyFormReferenceData(adminUserId: string) {
  await requirePermission(adminUserId, "FoodAcademy", "View");
  return { categories: await foodAcademyRepository.listAllFoodAcademyCategoriesForAdmin() };
}

export async function listFoodAcademyEntriesForAdmin(adminUserId: string, filters: FoodAcademyEntryAdminListFilters, page: number, pageSize: number) {
  await requirePermission(adminUserId, "FoodAcademy", "View");
  return foodAcademyRepository.listFoodAcademyEntriesForAdmin(filters, page, pageSize);
}

export async function getFoodAcademyEntryForAdmin(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "FoodAcademy", "View");
  return requireEntry(id);
}

async function assertCategoryExists(categoryId: string): Promise<void> {
  const category = await foodAcademyRepository.findFoodAcademyCategoryByIdForAdmin(categoryId);
  if (!category) throw new FoodAcademyCategoryNotFoundError();
}

function assertSectionsPresentForCourse(input: Pick<FoodAcademyEntryAdminWriteInput, "contentType" | "sections">): void {
  if (input.contentType === "Course" && input.sections.length === 0) throw new FoodAcademyCourseRequiresSectionsError();
}

export async function createFoodAcademyEntry(adminUserId: string, input: FoodAcademyEntryAdminWriteInput) {
  await requirePermission(adminUserId, "FoodAcademy", "Edit");
  await assertCategoryExists(input.categoryId);
  assertSectionsPresentForCourse(input);
  try {
    const created = await foodAcademyRepository.createFoodAcademyEntryAdmin(input);
    await writeAuditLog({ actorId: adminUserId, action: "food_academy_entry_created", module: "FoodAcademy", targetType: "FoodAcademyEntry", targetId: created.id });
    return created;
  } catch (error) {
    if (isUniqueConstraintViolation(error) && conflictField(error) === "slug") throw new FoodAcademyEntrySlugConflictError(input.slug);
    throw error;
  }
}

export async function updateFoodAcademyEntry(adminUserId: string, id: string, input: FoodAcademyEntryAdminWriteInput) {
  await requirePermission(adminUserId, "FoodAcademy", "Edit");
  await requireEntry(id);
  await assertCategoryExists(input.categoryId);
  assertSectionsPresentForCourse(input);
  try {
    const updated = await foodAcademyRepository.updateFoodAcademyEntryAdmin(id, input);
    await writeAuditLog({ actorId: adminUserId, action: "food_academy_entry_updated", module: "FoodAcademy", targetType: "FoodAcademyEntry", targetId: id });
    return updated;
  } catch (error) {
    if (isUniqueConstraintViolation(error) && conflictField(error) === "slug") throw new FoodAcademyEntrySlugConflictError(input.slug);
    throw error;
  }
}

export async function deleteFoodAcademyEntry(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "FoodAcademy", "Delete");
  await requireEntry(id);
  await foodAcademyRepository.deleteFoodAcademyEntryById(id);
  await writeAuditLog({ actorId: adminUserId, action: "food_academy_entry_deleted", module: "FoodAcademy", targetType: "FoodAcademyEntry", targetId: id });
}

export async function publishFoodAcademyEntry(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "FoodAcademy", "Approve");
  const entry = await requireEntry(id);
  assertPublishReady(entry);
  const updated = await foodAcademyRepository.updateFoodAcademyEntryStatus(id, { status: "Published", publishedAt: new Date() });
  await writeAuditLog({ actorId: adminUserId, action: "food_academy_entry_published", module: "FoodAcademy", targetType: "FoodAcademyEntry", targetId: id });
  return updated;
}

export async function unpublishFoodAcademyEntry(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "FoodAcademy", "Approve");
  await requireEntry(id);
  const updated = await foodAcademyRepository.updateFoodAcademyEntryStatus(id, { status: "Draft", publishedAt: null });
  await writeAuditLog({ actorId: adminUserId, action: "food_academy_entry_unpublished", module: "FoodAcademy", targetType: "FoodAcademyEntry", targetId: id });
  return updated;
}

export async function toggleFoodAcademyEntryFeatured(adminUserId: string, id: string, isFeatured: boolean) {
  await requirePermission(adminUserId, "FoodAcademy", "Edit");
  await requireEntry(id);
  const updated = await foodAcademyRepository.toggleFoodAcademyEntryFeatured(id, isFeatured);
  await writeAuditLog({ actorId: adminUserId, action: "food_academy_entry_featured_toggled", module: "FoodAcademy", targetType: "FoodAcademyEntry", targetId: id });
  return updated;
}

/** Rejects any id in orderedIds that isn't currently an isFeatured entry, so a stray/stale id can't silently reorder nothing (the repository's updateMany is scoped the same way as defense-in-depth). */
export async function reorderFoodAcademyFeaturedEntries(adminUserId: string, orderedIds: string[]) {
  await requirePermission(adminUserId, "FoodAcademy", "Edit");
  const featuredIds = new Set(await foodAcademyRepository.listFeaturedFoodAcademyEntryIdsForAdmin());
  for (const id of orderedIds) {
    if (!featuredIds.has(id)) throw new FoodAcademyEntryNotFoundError();
  }
  await foodAcademyRepository.reorderFoodAcademyEntries(orderedIds);
  await writeAuditLog({ actorId: adminUserId, action: "food_academy_featured_entries_reordered", module: "FoodAcademy", targetType: "FoodAcademyEntry" });
}
