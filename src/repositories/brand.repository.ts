import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export function createBrand(data: Prisma.BrandCreateInput) {
  return prisma.brand.create({ data });
}

export function findBrandBySlug(slug: string) {
  return prisma.brand.findUnique({ where: { slug } });
}

export function findBrandById(id: string) {
  return prisma.brand.findUnique({ where: { id } });
}

export function listBrands() {
  return prisma.brand.findMany({ orderBy: { name: "asc" } });
}
