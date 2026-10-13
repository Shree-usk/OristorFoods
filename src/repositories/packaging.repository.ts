import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

/**
 * The only place PackagingMethod/ProductPackagingOption are
 * queried/mutated (Story 3 — Custom Packaging).
 */

export function listAllPackagingMethodsForAdmin() {
  return prisma.packagingMethod.findMany({ orderBy: { name: "asc" } });
}

export function listActivePackagingMethods() {
  return prisma.packagingMethod.findMany({ where: { status: "Active" }, orderBy: { name: "asc" } });
}

export function findPackagingMethodById(id: string) {
  return prisma.packagingMethod.findUnique({ where: { id } });
}

export function findPackagingMethodByName(name: string) {
  return prisma.packagingMethod.findUnique({ where: { name } });
}

export function createPackagingMethod(data: Prisma.PackagingMethodCreateInput) {
  return prisma.packagingMethod.create({ data });
}

export function updatePackagingMethod(id: string, data: Prisma.PackagingMethodUpdateInput) {
  return prisma.packagingMethod.update({ where: { id }, data });
}

const withMethod = {
  packagingMethod: true,
} satisfies Prisma.ProductPackagingOptionInclude;

export type PackagingOptionWithMethod = Prisma.ProductPackagingOptionGetPayload<{ include: typeof withMethod }>;

export function findPackagingOptionById(id: string): Promise<PackagingOptionWithMethod | null> {
  return prisma.productPackagingOption.findUnique({ where: { id }, include: withMethod });
}

/** Admin per-product list — every row regardless of status, so the admin can see/reactivate a TemporarilyUnavailable or Discontinued option. */
export function findPackagingOptionsForProduct(productId: string): Promise<PackagingOptionWithMethod[]> {
  return prisma.productPackagingOption.findMany({ where: { productId }, include: withMethod, orderBy: { sortOrder: "asc" } });
}

/** Customer-facing: both the option and its method must be Active. */
export function findEligiblePackagingOptionsForProduct(productId: string): Promise<PackagingOptionWithMethod[]> {
  return prisma.productPackagingOption.findMany({
    where: { productId, status: "Active", packagingMethod: { status: "Active" } },
    include: withMethod,
    orderBy: { sortOrder: "asc" },
  });
}

/** Duplicate-prevention guard (app-level — see the Postgres NULL<>NULL gotcha documented on the schema model). excludeId lets an update check against every OTHER row. */
export function findDuplicatePackagingOption(productId: string, variantId: string | null, packagingMethodId: string, excludeId?: string) {
  return prisma.productPackagingOption.findFirst({
    where: { productId, variantId, packagingMethodId, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
}

export function createPackagingOption(data: Prisma.ProductPackagingOptionCreateInput): Promise<PackagingOptionWithMethod> {
  return prisma.productPackagingOption.create({ data, include: withMethod });
}

export function updatePackagingOption(id: string, data: Prisma.ProductPackagingOptionUpdateInput): Promise<PackagingOptionWithMethod> {
  return prisma.productPackagingOption.update({ where: { id }, data, include: withMethod });
}

export function deletePackagingOption(id: string) {
  return prisma.productPackagingOption.delete({ where: { id } });
}
