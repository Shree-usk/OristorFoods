import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** Homepage/Header redesign follow-up. The only place HomepageSectionFeature is queried/mutated — mirrors hero-banner.repository.ts's HeroBannerSlide CRUD exactly. */

export function findFeatureById(id: string) {
  return prisma.homepageSectionFeature.findUnique({ where: { id } });
}

export function createFeature(data: Prisma.HomepageSectionFeatureCreateInput) {
  return prisma.homepageSectionFeature.create({ data });
}

export interface UpdateFeatureInput {
  visible?: boolean;
  icon?: string;
  title?: string;
  description?: string;
}

export function updateFeature(id: string, input: UpdateFeatureInput) {
  return prisma.homepageSectionFeature.update({ where: { id }, data: input });
}

export function deleteFeatureById(id: string) {
  return prisma.homepageSectionFeature.delete({ where: { id } });
}

/** Rewrites every feature's sortOrder to match `orderedIds`'s position within one section — a single transaction. `updateMany` so `sectionId` can be combined with `id` as a safety filter. */
export function reorderFeatures(sectionId: string, orderedIds: string[]) {
  return prisma.$transaction(
    orderedIds.map((id, index) => prisma.homepageSectionFeature.updateMany({ where: { id, sectionId }, data: { sortOrder: index } })),
  );
}

export async function nextFeatureSortOrder(sectionId: string): Promise<number> {
  const last = await prisma.homepageSectionFeature.findFirst({ where: { sectionId }, orderBy: { sortOrder: "desc" } });
  return (last?.sortOrder ?? -1) + 1;
}
