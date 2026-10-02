import type { CustomerGroup } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** STORY-049. The only place RewardCampaign is queried/mutated. */

export function listCampaigns() {
  return prisma.rewardCampaign.findMany({ orderBy: { startDate: "desc" } });
}

/** Active campaigns covering `now`, matching either `customerGroup` exactly or targeting all groups (targetCustomerGroup: null). cart.service.ts::buildSummary picks the highest multiplier among these. */
export function findActiveCampaignsForGroup(customerGroup: CustomerGroup, now: Date) {
  return prisma.rewardCampaign.findMany({
    where: { isActive: true, startDate: { lte: now }, endDate: { gte: now }, OR: [{ targetCustomerGroup: null }, { targetCustomerGroup: customerGroup }] },
  });
}

export interface CreateCampaignInput {
  name: string;
  startDate: Date;
  endDate: Date;
  targetCustomerGroup: CustomerGroup | null;
  pointsMultiplier: string;
  isActive: boolean;
}

export function createCampaign(input: CreateCampaignInput) {
  return prisma.rewardCampaign.create({ data: input });
}

export function updateCampaign(id: string, input: Partial<CreateCampaignInput>) {
  return prisma.rewardCampaign.update({ where: { id }, data: input });
}
