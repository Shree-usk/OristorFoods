import type { SeasonalCampaignStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** STORY-050c. The only place SeasonalCampaign is queried/mutated. */

export function listSeasonalCampaignsForAdmin() {
  return prisma.seasonalCampaign.findMany({ orderBy: { createdAt: "desc" } });
}

export function findSeasonalCampaignById(id: string) {
  return prisma.seasonalCampaign.findUnique({ where: { id } });
}

export interface SeasonalCampaignContentInput {
  name: string;
  startDate: Date;
  endDate: Date;
  popupId: string | null;
  couponId: string | null;
  emailSmsCampaignId: string | null;
  homepageSectionId: string | null;
}

export function createSeasonalCampaign(input: SeasonalCampaignContentInput, createdById: string) {
  return prisma.seasonalCampaign.create({ data: { ...input, createdById } });
}

export function updateSeasonalCampaign(id: string, input: Partial<SeasonalCampaignContentInput>) {
  return prisma.seasonalCampaign.update({ where: { id }, data: input });
}

export function updateSeasonalCampaignStatus(id: string, status: SeasonalCampaignStatus) {
  return prisma.seasonalCampaign.update({ where: { id }, data: { status } });
}

/** Performance summary helper — the hub has no interaction data of its own, only a redemption count for its linked coupon (if any). */
export function countRedemptionsForCoupon(couponId: string) {
  return prisma.couponRedemption.count({ where: { couponId } });
}
