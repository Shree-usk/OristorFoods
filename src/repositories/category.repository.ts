import { prisma } from "@/lib/db";
import type { Category, Prisma } from "@/generated/prisma/client";

export function createCategory(data: Prisma.CategoryCreateInput) {
  return prisma.category.create({ data });
}

export function updateCategory(id: string, data: Prisma.CategoryUpdateInput) {
  return prisma.category.update({ where: { id }, data });
}

/** Next free sortOrder among root categories (STORY-pattern matches system-settings.repository.ts::nextPaymentMethodSortOrder) — new categories land at the end of the admin's list by default. */
export async function nextRootSortOrder(): Promise<number> {
  const last = await prisma.category.findFirst({ where: { parentId: null }, orderBy: { sortOrder: "desc" } });
  return (last?.sortOrder ?? -1) + 1;
}

export function findCategoryBySlug(slug: string) {
  return prisma.category.findUnique({ where: { slug } });
}

export function findCategoryById(id: string) {
  return prisma.category.findUnique({ where: { id } });
}

export function listRootCategories() {
  return prisma.category.findMany({
    where: { parentId: null },
    orderBy: { sortOrder: "asc" },
  });
}

export function listChildCategories(parentId: string) {
  return prisma.category.findMany({
    where: { parentId },
    orderBy: { sortOrder: "asc" },
  });
}

export function listAllCategories() {
  return prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
}

/** Homepage "Shop by Category" — only categories an admin has both activated and given an image, so an incomplete draft category never appears there. */
export function listFeaturedCategories(limit: number) {
  return prisma.category.findMany({
    where: { parentId: null, status: "Active", image: { not: null } },
    orderBy: { sortOrder: "asc" },
    take: limit,
  });
}

export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
}

export async function getCategoryTree(): Promise<CategoryTreeNode[]> {
  const all = await listAllCategories();
  const byParent = new Map<string | null, Category[]>();
  for (const category of all) {
    const key = category.parentId;
    const bucket = byParent.get(key) ?? [];
    bucket.push(category);
    byParent.set(key, bucket);
  }
  function build(parentId: string | null): CategoryTreeNode[] {
    return (byParent.get(parentId) ?? []).map((category) => ({
      ...category,
      children: build(category.id),
    }));
  }
  return build(null);
}

export async function listCategoryAndDescendantIds(categoryId: string): Promise<string[]> {
  const ids = [categoryId];
  const children = await listChildCategories(categoryId);
  for (const child of children) {
    ids.push(...(await listCategoryAndDescendantIds(child.id)));
  }
  return ids;
}

export interface CategoryPathItem {
  name: string;
  slug: string;
}

export async function getCategoryAncestorPath(categoryId: string): Promise<CategoryPathItem[]> {
  const path: CategoryPathItem[] = [];
  const visited = new Set<string>();
  let current = await findCategoryById(categoryId);
  while (current) {
    // Defends against a category-tree cycle (e.g. an admin accidentally
    // setting a category's parentId to one of its own descendants), which
    // would otherwise loop indefinitely inside a server-rendered PDP
    // request. Return the partial path built so far rather than throwing —
    // safer for a render path than a hard failure.
    if (visited.has(current.id)) break;
    visited.add(current.id);
    path.unshift({ name: current.name, slug: current.slug });
    if (!current.parentId) break;
    current = await findCategoryById(current.parentId);
  }
  return path;
}
