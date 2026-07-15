import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export function createCollection(data: Prisma.CollectionCreateInput) {
  return prisma.collection.create({ data });
}

export function findCollectionBySlug(slug: string) {
  return prisma.collection.findUnique({ where: { slug } });
}

export function findCollectionById(id: string) {
  return prisma.collection.findUnique({ where: { id } });
}

/**
 * Active collections currently in their seasonal/limited-time window (or
 * with no window set at all, i.e. always-on collections).
 */
export function listActiveCollections(date: Date = new Date()) {
  return prisma.collection.findMany({
    where: {
      status: "Active",
      OR: [
        { startDate: null, endDate: null },
        { startDate: { lte: date }, endDate: { gte: date } },
      ],
    },
    orderBy: { name: "asc" },
  });
}

export function getCollectionProducts(collectionId: string) {
  return prisma.product.findMany({
    where: { collections: { some: { id: collectionId } } },
  });
}
