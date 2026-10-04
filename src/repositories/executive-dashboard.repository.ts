import { prisma } from "@/lib/db";

/**
 * STORY-059c. Small, period-ranged siblings of STORY-039's existing
 * "since X" dashboard reads (rewards.repository.ts::countRedemptionsSince,
 * referral.repository.ts::countAttributionsSince, export-enquiry.repository.ts's
 * countWonSince/countLostSince) — new functions, not changes to those
 * already-shipped ones, since the Executive Dashboard needs a closed
 * [from, to] window for period-over-period comparison, not "since the
 * start of today."
 */

export interface LoyaltyEngagement {
  redemptions: number;
  referralSignups: number;
}

export async function getLoyaltyEngagementForRange(from: Date, to: Date): Promise<LoyaltyEngagement> {
  const [redemptions, referralSignups] = await Promise.all([
    prisma.rewardTransaction.count({ where: { type: "Redeemed", createdAt: { gte: from, lte: to } } }),
    prisma.referralAttribution.count({ where: { createdAt: { gte: from, lte: to } } }),
  ]);
  return { redemptions, referralSignups };
}

export async function getExportEnquiryVolumeForRange(from: Date, to: Date): Promise<number> {
  return prisma.exportEnquiry.count({ where: { createdAt: { gte: from, lte: to } } });
}
