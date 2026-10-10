import type { CategoryAdminFormInput } from "@/validation/category-admin.schema";
import * as categoryRepository from "@/repositories/category.repository";
import type { CategoryTreeNode } from "@/repositories/category.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { CategoryNotFoundError, CategoryParentCycleError, CategorySlugConflictError } from "@/services/category.errors";
import { requirePermission } from "@/services/permission.service";

function pruneInactive(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
  return nodes
    .filter((node) => node.status === "Active")
    .map((node) => ({ ...node, children: pruneInactive(node.children) }));
}

export async function getCategoryTreeForStorefront(): Promise<CategoryTreeNode[]> {
  const tree = await categoryRepository.getCategoryTree();
  return pruneInactive(tree);
}

/** Homepage "Shop by Category" — public, no permission gate, same pattern as getCategoryTreeForStorefront above and instagram.service.ts::getRecentPostsForStorefront. */
export function getFeaturedCategoriesForStorefront(limit: number) {
  return categoryRepository.listFeaturedCategories(limit);
}

// --- Admin (Products module — categories are product reference data, same as Brands) ---

export async function listCategoriesForAdmin(adminUserId: string): Promise<CategoryTreeNode[]> {
  await requirePermission(adminUserId, "Products", "View");
  return categoryRepository.getCategoryTree();
}

/** Clears a blank string back to a real SQL NULL rather than storing "" — keeps listFeaturedCategories' `image: { not: null }` filter meaningful. */
function nullIfBlank(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value === null || value.trim() === "" ? null : value;
}

async function assertNoSlugConflict(slug: string, excludeId?: string): Promise<void> {
  const existing = await categoryRepository.findCategoryBySlug(slug);
  if (existing && existing.id !== excludeId) throw new CategorySlugConflictError();
}

async function assertValidParent(parentId: string | null | undefined, selfId?: string): Promise<void> {
  if (!parentId) return;
  const parent = await categoryRepository.findCategoryById(parentId);
  if (!parent) throw new CategoryNotFoundError();
  if (!selfId) return;
  // A category can't become a descendant of itself — walk selfId's own
  // subtree and reject if the proposed parent is in it (includes selfId).
  const descendantIds = await categoryRepository.listCategoryAndDescendantIds(selfId);
  if (descendantIds.includes(parentId)) throw new CategoryParentCycleError();
}

export async function createCategoryAdmin(adminUserId: string, input: CategoryAdminFormInput) {
  await requirePermission(adminUserId, "Products", "Edit");
  await assertNoSlugConflict(input.slug);
  await assertValidParent(input.parentId);

  const sortOrder = input.sortOrder ?? (input.parentId ? (await categoryRepository.listChildCategories(input.parentId)).length : await categoryRepository.nextRootSortOrder());

  const category = await categoryRepository.createCategory({
    name: input.name,
    slug: input.slug,
    description: nullIfBlank(input.description) ?? null,
    image: nullIfBlank(input.image) ?? null,
    sortOrder,
    status: input.status ?? "Active",
    parent: input.parentId ? { connect: { id: input.parentId } } : undefined,
    metaTitle: nullIfBlank(input.metaTitle) ?? null,
    metaDescription: nullIfBlank(input.metaDescription) ?? null,
    canonicalUrl: nullIfBlank(input.canonicalUrl) ?? null,
    ogImage: nullIfBlank(input.ogImage) ?? null,
  });
  await writeAuditLog({ actorId: adminUserId, action: "category_created", module: "Products", targetType: "Category", targetId: category.id });
  return category;
}

export async function updateCategoryAdmin(adminUserId: string, id: string, input: Partial<CategoryAdminFormInput>) {
  await requirePermission(adminUserId, "Products", "Edit");
  const existing = await categoryRepository.findCategoryById(id);
  if (!existing) throw new CategoryNotFoundError();
  if (input.slug) await assertNoSlugConflict(input.slug, id);
  if ("parentId" in input) await assertValidParent(input.parentId, id);

  const category = await categoryRepository.updateCategory(id, {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.slug !== undefined && { slug: input.slug }),
    ...(input.description !== undefined && { description: nullIfBlank(input.description) }),
    ...(input.image !== undefined && { image: nullIfBlank(input.image) }),
    ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
    ...(input.status !== undefined && { status: input.status }),
    ...("parentId" in input && { parent: input.parentId ? { connect: { id: input.parentId } } : { disconnect: true } }),
    ...(input.metaTitle !== undefined && { metaTitle: nullIfBlank(input.metaTitle) }),
    ...(input.metaDescription !== undefined && { metaDescription: nullIfBlank(input.metaDescription) }),
    ...(input.canonicalUrl !== undefined && { canonicalUrl: nullIfBlank(input.canonicalUrl) }),
    ...(input.ogImage !== undefined && { ogImage: nullIfBlank(input.ogImage) }),
  });
  await writeAuditLog({ actorId: adminUserId, action: "category_updated", module: "Products", targetType: "Category", targetId: id });
  return category;
}
