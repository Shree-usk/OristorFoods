import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

const withImages = { images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] } } satisfies Prisma.ProductVariantInclude;

export function findVariantById(id: string) {
  return prisma.productVariant.findUnique({ where: { id }, include: withImages });
}

export function findVariantsByProductId(productId: string) {
  return prisma.productVariant.findMany({ where: { productId }, include: withImages, orderBy: { sortOrder: "asc" } });
}

/** Bulk fetch for cart/checkout — one query regardless of how many distinct variants a cart holds, same discipline as pricing.repository.ts's resolvePricesForProducts. */
export function findVariantsByIds(ids: string[]) {
  return prisma.productVariant.findMany({ where: { id: { in: ids } }, include: withImages });
}

export function createVariant(data: Prisma.ProductVariantCreateInput) {
  return prisma.productVariant.create({ data, include: withImages });
}

export function updateVariant(id: string, data: Prisma.ProductVariantUpdateInput) {
  return prisma.productVariant.update({ where: { id }, data, include: withImages });
}

export function deleteVariant(id: string) {
  return prisma.productVariant.delete({ where: { id } });
}

export function countOrderItemsForVariant(variantId: string) {
  return prisma.orderItem.count({ where: { variantId } });
}

export function setVariantImages(variantId: string, images: { url: string; altText?: string | null; isPrimary?: boolean; sortOrder?: number }[]) {
  return prisma.$transaction([
    prisma.productVariantImage.deleteMany({ where: { variantId } }),
    prisma.productVariantImage.createMany({ data: images.map((image, index) => ({ variantId, url: image.url, altText: image.altText ?? null, isPrimary: image.isPrimary ?? false, sortOrder: image.sortOrder ?? index })) }),
  ]);
}
