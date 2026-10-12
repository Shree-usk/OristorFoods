import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

/**
 * The only place ProductBundle/BundleItem/BundleImage are queried/mutated
 * (Story 2 — Bundles). Replaces the three dead createBundle/addBundleItem/
 * getBundleWithItems functions that used to live in product.repository.ts
 * (zero production callers — confirmed before this story).
 */

const withItemsAndImages = {
  items: {
    include: {
      componentProduct: { include: { images: { where: { isPrimary: true }, take: 1 } } },
      componentVariant: true,
    },
    orderBy: { sortOrder: "asc" },
  },
  images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
} satisfies Prisma.ProductBundleInclude;

export type BundleWithItems = Prisma.ProductBundleGetPayload<{ include: typeof withItemsAndImages }>;

export function findBundleById(id: string): Promise<BundleWithItems | null> {
  return prisma.productBundle.findUnique({ where: { id }, include: withItemsAndImages });
}

export function findBundleByProductId(productId: string): Promise<BundleWithItems | null> {
  return prisma.productBundle.findUnique({ where: { productId }, include: withItemsAndImages });
}

/** Bulk fetch for cart re-validation — one query per distinct bundle regardless of how many instances are in the cart. */
export function findBundlesByIds(ids: string[]): Promise<BundleWithItems[]> {
  if (ids.length === 0) return Promise.resolve([]);
  return prisma.productBundle.findMany({ where: { id: { in: ids } }, include: withItemsAndImages });
}

export function createBundle(data: Prisma.ProductBundleCreateInput): Promise<BundleWithItems> {
  return prisma.productBundle.create({ data, include: withItemsAndImages });
}

export function updateBundle(id: string, data: Prisma.ProductBundleUpdateInput): Promise<BundleWithItems> {
  return prisma.productBundle.update({ where: { id }, data, include: withItemsAndImages });
}

export function deleteBundle(id: string) {
  return prisma.productBundle.delete({ where: { id } });
}

export function createBundleItem(data: Prisma.BundleItemCreateInput) {
  return prisma.bundleItem.create({ data });
}

export function updateBundleItem(id: string, data: Prisma.BundleItemUpdateInput) {
  return prisma.bundleItem.update({ where: { id }, data });
}

export function deleteBundleItem(id: string) {
  return prisma.bundleItem.delete({ where: { id } });
}

export function findBundleItemById(id: string) {
  return prisma.bundleItem.findUnique({ where: { id } });
}

export function setBundleImages(bundleId: string, images: { url: string; altText?: string | null; isPrimary?: boolean; sortOrder?: number }[]) {
  return prisma.$transaction([
    prisma.bundleImage.deleteMany({ where: { bundleId } }),
    prisma.bundleImage.createMany({
      data: images.map((image, index) => ({
        bundleId,
        url: image.url,
        altText: image.altText ?? null,
        isPrimary: image.isPrimary ?? false,
        sortOrder: image.sortOrder ?? index,
      })),
    }),
  ]);
}
