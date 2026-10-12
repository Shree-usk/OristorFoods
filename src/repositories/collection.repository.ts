import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export function createCollection(data: Prisma.CollectionCreateInput) {
  return prisma.collection.create({ data });
}

export function updateCollection(id: string, data: Prisma.CollectionUpdateInput) {
  return prisma.collection.update({ where: { id }, data });
}

export function findCollectionBySlug(slug: string) {
  return prisma.collection.findUnique({ where: { slug } });
}

export function findCollectionById(id: string) {
  return prisma.collection.findUnique({ where: { id } });
}

export function listAllCollectionsForAdmin() {
  return prisma.collection.findMany({
    include: { products: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });
}

/**
 * Active collections currently in their seasonal/limited-time window (or
 * with no window set at all, i.e. always-on collections). One-sided
 * windows are supported: a collection with only `startDate` set is active
 * from that date onward with no upper bound, and a collection with only
 * `endDate` set is active up to that date with no lower bound.
 */
export function listActiveCollections(date: Date = new Date()) {
  return prisma.collection.findMany({
    where: {
      status: "Active",
      OR: [
        { startDate: null, endDate: null },
        { startDate: { lte: date }, endDate: { gte: date } },
        { startDate: { lte: date }, endDate: null },
        { startDate: null, endDate: { gte: date } },
      ],
    },
    orderBy: { name: "asc" },
  });
}

/** Homepage "Product Collections" — only collections an admin has both activated and given an image, and that are inside their active window (same rule as listActiveCollections), so an incomplete draft or an expired/future seasonal collection never appears there. */
export function listFeaturedCollections(limit: number, date: Date = new Date()) {
  return prisma.collection.findMany({
    where: {
      status: "Active",
      image: { not: null },
      OR: [
        { startDate: null, endDate: null },
        { startDate: { lte: date }, endDate: { gte: date } },
        { startDate: { lte: date }, endDate: null },
        { startDate: null, endDate: { gte: date } },
      ],
    },
    orderBy: { name: "asc" },
    take: limit,
  });
}

export function getCollectionProducts(collectionId: string) {
  return prisma.product.findMany({
    where: { collections: { some: { id: collectionId } } },
  });
}
