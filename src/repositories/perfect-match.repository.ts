import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** Homepage "The Perfect Match" section. Only place PerfectMatchSetting/PerfectMatchProduct/PerfectMatchPairing are queried/mutated — same flat, admin-ordered-list shape as export-content.repository.ts. */

// --- Section intro copy (singleton, id: "global" — same convention as ExportHeroSetting/FoodAcademyPageSetting) ---

export function getPerfectMatchSetting() {
  return prisma.perfectMatchSetting.findUnique({ where: { id: "global" } });
}

export function upsertPerfectMatchSetting(input: Prisma.PerfectMatchSettingUncheckedCreateInput) {
  return prisma.perfectMatchSetting.upsert({ where: { id: "global" }, create: { id: "global", ...input }, update: input });
}

// --- Products linked into the rail ---

export function listPerfectMatchProducts() {
  return prisma.perfectMatchProduct.findMany({
    orderBy: { sortOrder: "asc" },
    include: { product: { select: { id: true, name: true, slug: true, shortDescription: true, status: true, images: { where: { isPrimary: true }, take: 1 } } } },
  });
}

/**
 * Storefront read for the homepage rail (perfect-match.service.ts). Ordered
 * default-featured-first so the Client Component's initial tab is exactly
 * the admin's chosen default (falling back to plain sortOrder when none is
 * set). `pairings` is capped at 4 defensively — the admin service already
 * enforces the max at write time, this just guards against a direct DB
 * edit bypassing it.
 */
export function listPublishedPerfectMatchProducts() {
  return prisma.perfectMatchProduct.findMany({
    where: { status: "Published" },
    orderBy: [{ isDefaultFeatured: "desc" }, { sortOrder: "asc" }],
    include: {
      product: { select: { name: true, slug: true, shortDescription: true, status: true, images: { where: { isPrimary: true }, take: 1 } } },
      pairings: { where: { status: "Published" }, orderBy: { sortOrder: "asc" }, take: 4 },
    },
  });
}

export function findPerfectMatchProductById(id: string) {
  return prisma.perfectMatchProduct.findUnique({
    where: { id },
    include: { product: { select: { id: true, name: true, slug: true, shortDescription: true, status: true, images: { where: { isPrimary: true }, take: 1 } } } },
  });
}

export function findPerfectMatchProductByProductId(productId: string) {
  return prisma.perfectMatchProduct.findUnique({ where: { productId } });
}

export function createPerfectMatchProduct(data: Prisma.PerfectMatchProductCreateInput) {
  return prisma.perfectMatchProduct.create({ data });
}

export interface UpdatePerfectMatchProductInput {
  tabLabel?: string | null;
  kicker?: string | null;
  promoDescriptionOverride?: string | null;
  isDefaultFeatured?: boolean;
  status?: "Draft" | "Published";
}

export function updatePerfectMatchProduct(id: string, input: UpdatePerfectMatchProductInput) {
  return prisma.perfectMatchProduct.update({ where: { id }, data: input });
}

/** Clears isDefaultFeatured on every OTHER product — called before setting a new default, so exactly one product is ever the default at a time. */
export function clearOtherDefaultFeaturedProducts(exceptId: string) {
  return prisma.perfectMatchProduct.updateMany({ where: { id: { not: exceptId } }, data: { isDefaultFeatured: false } });
}

export function deletePerfectMatchProductById(id: string) {
  return prisma.perfectMatchProduct.delete({ where: { id } });
}

export function reorderPerfectMatchProducts(orderedIds: string[]) {
  return prisma.$transaction(
    orderedIds.map((id, index) => prisma.perfectMatchProduct.updateMany({ where: { id }, data: { sortOrder: index } })),
  );
}

export async function nextPerfectMatchProductSortOrder(): Promise<number> {
  const last = await prisma.perfectMatchProduct.findFirst({ orderBy: { sortOrder: "desc" } });
  return (last?.sortOrder ?? -1) + 1;
}

// --- Meal-pairing cards, per product ---

export function listPerfectMatchPairingsByProduct(perfectMatchProductId: string) {
  return prisma.perfectMatchPairing.findMany({ where: { perfectMatchProductId }, orderBy: { sortOrder: "asc" } });
}

export function listPublishedPerfectMatchPairingsByProduct(perfectMatchProductId: string) {
  return prisma.perfectMatchPairing.findMany({ where: { perfectMatchProductId, status: "Published" }, orderBy: { sortOrder: "asc" } });
}

export function findPerfectMatchPairingById(id: string) {
  return prisma.perfectMatchPairing.findUnique({ where: { id } });
}

export function createPerfectMatchPairing(data: Prisma.PerfectMatchPairingCreateInput) {
  return prisma.perfectMatchPairing.create({ data });
}

export interface UpdatePerfectMatchPairingInput {
  title?: string;
  description?: string | null;
  imageUrl?: string;
  imageAlt?: string | null;
  categoryLabel?: string | null;
  supportingTag?: string | null;
  status?: "Draft" | "Published";
}

export function updatePerfectMatchPairing(id: string, input: UpdatePerfectMatchPairingInput) {
  return prisma.perfectMatchPairing.update({ where: { id }, data: input });
}

export function deletePerfectMatchPairingById(id: string) {
  return prisma.perfectMatchPairing.delete({ where: { id } });
}

export function reorderPerfectMatchPairings(orderedIds: string[]) {
  return prisma.$transaction(
    orderedIds.map((id, index) => prisma.perfectMatchPairing.updateMany({ where: { id }, data: { sortOrder: index } })),
  );
}

export async function nextPerfectMatchPairingSortOrder(perfectMatchProductId: string): Promise<number> {
  const last = await prisma.perfectMatchPairing.findFirst({ where: { perfectMatchProductId }, orderBy: { sortOrder: "desc" } });
  return (last?.sortOrder ?? -1) + 1;
}

export function countPublishedPerfectMatchPairings(perfectMatchProductId: string) {
  return prisma.perfectMatchPairing.count({ where: { perfectMatchProductId, status: "Published" } });
}
