import { prisma } from "@/lib/db";
import type { Category, Prisma } from "@/generated/prisma/client";

export function createCategory(data: Prisma.CategoryCreateInput) {
  return prisma.category.create({ data });
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
