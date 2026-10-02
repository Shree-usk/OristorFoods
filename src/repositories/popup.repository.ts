import type { CustomerGroup, Prisma, PopupAudienceTarget, PopupPageTarget, PopupStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** STORY-050a. The only place PromotionalPopup is queried/mutated. */

export function listPopupsForAdmin() {
  return prisma.promotionalPopup.findMany({ orderBy: { createdAt: "desc" } });
}

export function findPopupById(id: string) {
  return prisma.promotionalPopup.findUnique({ where: { id } });
}

export interface PopupContentInput {
  name: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  mobileImageUrl: string | null;
  mobileImageAlt: string | null;
  videoUrl: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  secondaryCtaLabel: string | null;
  secondaryCtaHref: string | null;
  couponCode: string | null;
  pageTarget: PopupPageTarget;
  audienceTarget: PopupAudienceTarget;
  targetCustomerGroup: CustomerGroup | null;
  triggerType: Prisma.PromotionalPopupCreateInput["triggerType"];
  triggerValue: number | null;
  frequencyCap: Prisma.PromotionalPopupCreateInput["frequencyCap"];
  startAt: Date | null;
  endAt: Date | null;
  variantGroupId: string | null;
  variantWeight: number;
}

export function createPopup(input: PopupContentInput, createdById: string) {
  return prisma.promotionalPopup.create({ data: { ...input, createdById } });
}

export function updatePopup(id: string, input: Partial<PopupContentInput>) {
  return prisma.promotionalPopup.update({ where: { id }, data: input });
}

export function updatePopupStatus(id: string, status: PopupStatus) {
  return prisma.promotionalPopup.update({ where: { id }, data: { status } });
}

/** The eligibility resolver's own read — Published, within the schedule window (nullable bounds treated as open-ended), matching pageTarget or AllPages. */
export function findEligiblePopups(pageTarget: PopupPageTarget, now: Date) {
  return prisma.promotionalPopup.findMany({
    where: {
      status: "Published",
      OR: [{ pageTarget: "AllPages" }, { pageTarget }],
      AND: [{ OR: [{ startAt: null }, { startAt: { lte: now } }] }, { OR: [{ endAt: null }, { endAt: { gte: now } }] }],
    },
  });
}

/** Every sibling sharing a variantGroupId — including the one already matched — for the weighted A/B pick. */
export function findVariantSiblings(variantGroupId: string) {
  return prisma.promotionalPopup.findMany({ where: { variantGroupId, status: "Published" } });
}
