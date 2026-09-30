import type { HomepageLayoutStatus, HomepageSectionType, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** STORY-042. The only place HomepageLayout/HomepageSection are queried/mutated (HeroBannerSlide lives in hero-banner.repository.ts). */

const withSections = {
  sections: {
    orderBy: { sortOrder: "asc" },
    include: { banners: { orderBy: { sortOrder: "asc" } } },
  },
} satisfies Prisma.HomepageLayoutInclude;

export type HomepageLayoutDetail = Prisma.HomepageLayoutGetPayload<{ include: typeof withSections }>;

export function createLayout(data: Prisma.HomepageLayoutCreateInput): Promise<HomepageLayoutDetail> {
  return prisma.homepageLayout.create({ data, include: withSections });
}

export function findLayoutById(id: string): Promise<HomepageLayoutDetail | null> {
  return prisma.homepageLayout.findUnique({ where: { id }, include: withSections });
}

/** Storefront-facing read — the currently-live layout, or null before any layout has ever been published. */
export function findPublishedLayout(): Promise<HomepageLayoutDetail | null> {
  return prisma.homepageLayout.findFirst({ where: { status: "Published" }, include: withSections });
}

/** The most-recently-published layout that's since been superseded — the one-level rollback target. */
export function findMostRecentlyArchivedLayout(): Promise<HomepageLayoutDetail | null> {
  return prisma.homepageLayout.findFirst({ where: { status: "Archived" }, orderBy: { updatedAt: "desc" }, include: withSections });
}

export function listLayouts(status?: HomepageLayoutStatus) {
  return prisma.homepageLayout.findMany({
    where: status ? { status } : undefined,
    orderBy: { updatedAt: "desc" },
    include: { sections: { select: { id: true } } },
  });
}

export function deleteLayoutById(id: string) {
  return prisma.homepageLayout.delete({ where: { id } });
}

/**
 * Publishes `id` and, if a different layout is currently Published,
 * archives it in the same transaction — an atomic swap, never a moment
 * with zero or two Published layouts.
 */
export function publishLayoutSwappingPrevious(id: string) {
  return prisma.$transaction(async (tx) => {
    const currentlyPublished = await tx.homepageLayout.findFirst({ where: { status: "Published", id: { not: id } } });
    if (currentlyPublished) {
      await tx.homepageLayout.update({ where: { id: currentlyPublished.id }, data: { status: "Archived" } });
    }
    return tx.homepageLayout.update({
      where: { id },
      data: { status: "Published", publishedAt: new Date() },
      include: withSections,
    });
  });
}

export function updateLayoutAuditFields(id: string, updatedById: string) {
  return prisma.homepageLayout.update({ where: { id }, data: { updatedById } });
}

export function findSectionById(id: string) {
  return prisma.homepageSection.findUnique({ where: { id }, include: { banners: { orderBy: { sortOrder: "asc" } } } });
}

export function countSectionsByType(layoutId: string, type: HomepageSectionType) {
  return prisma.homepageSection.count({ where: { layoutId, type } });
}

export function createSection(data: Prisma.HomepageSectionCreateInput) {
  return prisma.homepageSection.create({ data, include: { banners: true } });
}

export interface UpdateSectionInput {
  visible?: boolean;
  titleOverride?: string | null;
  descriptionOverride?: string | null;
}

export function updateSection(id: string, input: UpdateSectionInput) {
  return prisma.homepageSection.update({
    where: { id },
    data: {
      ...(input.visible !== undefined ? { visible: input.visible } : {}),
      ...(input.titleOverride !== undefined ? { titleOverride: input.titleOverride } : {}),
      ...(input.descriptionOverride !== undefined ? { descriptionOverride: input.descriptionOverride } : {}),
    },
    include: { banners: true },
  });
}

export function deleteSectionById(id: string) {
  return prisma.homepageSection.delete({ where: { id } });
}

/**
 * Rewrites every section's sortOrder to match `orderedIds`'s position — a
 * single transaction so the list is never half-reordered. `updateMany`
 * (not `update`) so the `layoutId` filter can be combined with `id`
 * without needing a redundant compound-unique constraint.
 */
export function reorderSections(layoutId: string, orderedIds: string[]) {
  return prisma.$transaction(
    orderedIds.map((id, index) => prisma.homepageSection.updateMany({ where: { id, layoutId }, data: { sortOrder: index } })),
  );
}

export async function nextSectionSortOrder(layoutId: string): Promise<number> {
  const last = await prisma.homepageSection.findFirst({ where: { layoutId }, orderBy: { sortOrder: "desc" } });
  return (last?.sortOrder ?? -1) + 1;
}
