import { prisma } from "@/lib/db";
import type { Prisma, ProductStatus } from "@/generated/prisma/client";

export function createProduct(data: Prisma.ProductCreateInput) {
  return prisma.product.create({ data });
}

export function findProductBySlug(slug: string) {
  return prisma.product.findUnique({ where: { slug } });
}

export function findProductBySku(sku: string) {
  return prisma.product.findUnique({ where: { sku } });
}

export function findProductById(id: string) {
  return prisma.product.findUnique({ where: { id } });
}

export function listProductsByCategory(categoryId: string) {
  return prisma.product.findMany({
    where: { categories: { some: { id: categoryId } } },
  });
}

export function listProductsByStatus(status: ProductStatus) {
  return prisma.product.findMany({ where: { status } });
}

export function addProductImage(data: Prisma.ProductImageCreateInput) {
  return prisma.productImage.create({ data });
}

export function addProductVideo(data: Prisma.ProductVideoCreateInput) {
  return prisma.productVideo.create({ data });
}

export function listProductImages(productId: string) {
  return prisma.productImage.findMany({
    where: { productId },
    orderBy: { sortOrder: "asc" },
  });
}

export function listProductVideos(productId: string) {
  return prisma.productVideo.findMany({
    where: { productId },
    orderBy: { sortOrder: "asc" },
  });
}
