import { prisma } from "@/lib/db";

export function findOrCreateWishlist(userId: string) {
  return prisma.wishlist.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

export function addItem(wishlistId: string, productId: string) {
  return prisma.wishlistItem.create({
    data: { wishlistId, productId },
  });
}

export function removeItem(wishlistId: string, productId: string) {
  // deleteMany (not delete) so removing an item that's already gone is a
  // no-op rather than a thrown P2025 — a double-click or a stale UI
  // state shouldn't 500.
  return prisma.wishlistItem.deleteMany({
    where: { wishlistId, productId },
  });
}

export function listItemsWithProduct(wishlistId: string) {
  return prisma.wishlistItem.findMany({
    where: { wishlistId, product: { status: "Published" } },
    include: {
      product: {
        include: {
          images: { where: { isPrimary: true }, take: 1 },
        },
      },
    },
    orderBy: { addedAt: "desc" },
  });
}

export function findExistingProductIds(wishlistId: string, productIds: string[]): Promise<string[]> {
  if (productIds.length === 0) return Promise.resolve([]);
  return prisma.wishlistItem
    .findMany({
      where: { wishlistId, productId: { in: productIds } },
      select: { productId: true },
    })
    .then((rows) => rows.map((row) => row.productId));
}
