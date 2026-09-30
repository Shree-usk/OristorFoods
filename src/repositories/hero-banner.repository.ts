import type { ContentAlignment, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** STORY-042. The only place HeroBannerSlide is queried/mutated. */

export function findSlideById(id: string) {
  return prisma.heroBannerSlide.findUnique({ where: { id } });
}

export function createSlide(data: Prisma.HeroBannerSlideCreateInput) {
  return prisma.heroBannerSlide.create({ data });
}

export interface UpdateSlideInput {
  visible?: boolean;
  headline?: string;
  subheadline?: string | null;
  supportingText?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  secondaryCtaLabel?: string | null;
  secondaryCtaHref?: string | null;
  desktopImageUrl?: string;
  desktopImageAlt?: string;
  mobileImageUrl?: string | null;
  mobileImageAlt?: string | null;
  videoUrl?: string | null;
  overlayEnabled?: boolean;
  alignment?: ContentAlignment;
}

export function updateSlide(id: string, input: UpdateSlideInput) {
  return prisma.heroBannerSlide.update({ where: { id }, data: input });
}

export function deleteSlideById(id: string) {
  return prisma.heroBannerSlide.delete({ where: { id } });
}

/** Rewrites every slide's sortOrder to match `orderedIds`'s position within one section — a single transaction. `updateMany` so `sectionId` can be combined with `id` as a safety filter. */
export function reorderSlides(sectionId: string, orderedIds: string[]) {
  return prisma.$transaction(
    orderedIds.map((id, index) => prisma.heroBannerSlide.updateMany({ where: { id, sectionId }, data: { sortOrder: index } })),
  );
}

export async function nextSlideSortOrder(sectionId: string): Promise<number> {
  const last = await prisma.heroBannerSlide.findFirst({ where: { sectionId }, orderBy: { sortOrder: "desc" } });
  return (last?.sortOrder ?? -1) + 1;
}
