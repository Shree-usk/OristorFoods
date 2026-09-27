import { prisma } from "@/lib/db";

export function addBookmark(recipeId: string, customerId: string) {
  return prisma.recipeBookmark.create({ data: { recipeId, customerId } });
}

export function removeBookmark(recipeId: string, customerId: string) {
  // deleteMany (not delete) so removing a bookmark that's already gone is a
  // no-op rather than a thrown P2025 — matches wishlist.repository.ts's
  // removeItem.
  return prisma.recipeBookmark.deleteMany({ where: { recipeId, customerId } });
}

export function isBookmarked(recipeId: string, customerId: string): Promise<boolean> {
  return prisma.recipeBookmark
    .findUnique({ where: { recipeId_customerId: { recipeId, customerId } } })
    .then((row) => row !== null);
}

export function listBookmarkedRecipeIdsForCustomer(customerId: string): Promise<string[]> {
  return prisma.recipeBookmark
    .findMany({
      where: { customerId, recipe: { status: "Published" } },
      orderBy: { createdAt: "desc" },
      select: { recipeId: true },
    })
    .then((rows) => rows.map((row) => row.recipeId));
}

export function findExistingBookmarkedRecipeIds(customerId: string, recipeIds: string[]): Promise<string[]> {
  if (recipeIds.length === 0) return Promise.resolve([]);
  return prisma.recipeBookmark
    .findMany({
      where: { customerId, recipeId: { in: recipeIds } },
      select: { recipeId: true },
    })
    .then((rows) => rows.map((row) => row.recipeId));
}
