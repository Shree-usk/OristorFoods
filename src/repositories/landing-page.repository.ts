import type { ContentAlignment, LandingPageStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** STORY-050e. The only place LandingPage/LandingPageBlock are queried/mutated. */

const withBlocks = {
  blocks: { orderBy: { sortOrder: "asc" } },
} satisfies Prisma.LandingPageInclude;

export type LandingPageWithBlocks = Prisma.LandingPageGetPayload<{ include: typeof withBlocks }>;

export function listLandingPagesForAdmin() {
  return prisma.landingPage.findMany({ orderBy: { createdAt: "desc" } });
}

export function findLandingPageById(id: string): Promise<LandingPageWithBlocks | null> {
  return prisma.landingPage.findUnique({ where: { id }, include: withBlocks });
}

/** STORY-051c. The sitemap's own read — every live landing page, not just one by slug. */
export function listPublishedLandingPages() {
  return prisma.landingPage.findMany({ where: { status: "Published" }, select: { slug: true, updatedAt: true } });
}

/** The storefront's own read — Published only, visible blocks only. */
export function findPublishedLandingPageBySlug(slug: string) {
  return prisma.landingPage.findFirst({
    where: { slug, status: "Published" },
    include: { blocks: { where: { visible: true }, orderBy: { sortOrder: "asc" } } },
  });
}

export interface LandingPageContentInput {
  name: string;
  slug: string;
  metaTitle: string | null;
  metaDescription: string | null;
}

export function createLandingPage(input: LandingPageContentInput, createdById: string) {
  return prisma.landingPage.create({ data: { ...input, createdById } });
}

export function updateLandingPage(id: string, input: Partial<LandingPageContentInput>) {
  return prisma.landingPage.update({ where: { id }, data: input });
}

export function updateLandingPageStatus(id: string, status: LandingPageStatus, publishedAt: Date | null) {
  return prisma.landingPage.update({ where: { id }, data: { status, publishedAt } });
}

export interface LandingPageBlockInput {
  headline: string;
  subheadline: string | null;
  supportingText: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  secondaryCtaLabel: string | null;
  secondaryCtaHref: string | null;
  desktopImageUrl: string;
  desktopImageAlt: string;
  mobileImageUrl: string | null;
  mobileImageAlt: string | null;
  videoUrl: string | null;
  overlayEnabled: boolean;
  alignment: ContentAlignment;
}

export async function createBlock(landingPageId: string, input: LandingPageBlockInput) {
  const maxSortOrder = await prisma.landingPageBlock.aggregate({ where: { landingPageId }, _max: { sortOrder: true } });
  const sortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1;
  return prisma.landingPageBlock.create({ data: { ...input, landingPageId, sortOrder } });
}

export function updateBlock(id: string, input: Partial<LandingPageBlockInput & { visible: boolean }>) {
  return prisma.landingPageBlock.update({ where: { id }, data: input });
}

export function deleteBlock(id: string) {
  return prisma.landingPageBlock.delete({ where: { id } });
}

export function findBlockById(id: string) {
  return prisma.landingPageBlock.findUnique({ where: { id } });
}

/** A simple sequential sortOrder rewrite — no dnd-kit machinery needed at this story's scope. */
export async function reorderBlocks(landingPageId: string, orderedBlockIds: string[]) {
  await prisma.$transaction(orderedBlockIds.map((id, index) => prisma.landingPageBlock.update({ where: { id, landingPageId }, data: { sortOrder: index } })));
}
