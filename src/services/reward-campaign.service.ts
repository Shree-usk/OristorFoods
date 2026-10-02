import type { CustomerGroup } from "@/generated/prisma/client";
import * as rewardCampaignRepository from "@/repositories/reward-campaign.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { CampaignDateRangeInvalidError } from "@/services/reward-campaign.errors";
import { requirePermission } from "@/services/permission.service";

/**
 * STORY-049. Time-boxed points multipliers, optionally scoped to a
 * CustomerGroup. resolveActiveMultiplier is called once per cart read
 * (cart.service.ts::buildSummary), mirroring exactly how
 * discount.service.ts::resolveDiscountForCart is already called once per
 * cart read for coupons/promotions — no separate snapshot step is needed
 * at checkout since checkout.service.ts::placeOrder re-reads the cart
 * through the same buildSummary call.
 */

/** No active campaign -> 1 (no-op multiplier). More than one match -> the highest wins, a simple, explainable tie-break. */
export async function resolveActiveMultiplier(customerGroup: CustomerGroup, now: Date = new Date()): Promise<number> {
  const campaigns = await rewardCampaignRepository.findActiveCampaignsForGroup(customerGroup, now);
  if (campaigns.length === 0) return 1;
  return Math.max(...campaigns.map((campaign) => campaign.pointsMultiplier.toNumber()));
}

export async function listCampaignsForAdmin(adminUserId: string) {
  await requirePermission(adminUserId, "RewardsReferrals", "View");
  return rewardCampaignRepository.listCampaigns();
}

export interface CampaignInput {
  name: string;
  startDate: Date;
  endDate: Date;
  targetCustomerGroup: CustomerGroup | null;
  pointsMultiplier: number;
  isActive: boolean;
}

function assertValidRange(startDate: Date, endDate: Date) {
  if (endDate <= startDate) throw new CampaignDateRangeInvalidError();
}

export async function createCampaign(adminUserId: string, input: CampaignInput) {
  await requirePermission(adminUserId, "RewardsReferrals", "Edit");
  assertValidRange(input.startDate, input.endDate);

  const campaign = await rewardCampaignRepository.createCampaign({
    name: input.name,
    startDate: input.startDate,
    endDate: input.endDate,
    targetCustomerGroup: input.targetCustomerGroup,
    pointsMultiplier: input.pointsMultiplier.toFixed(2),
    isActive: input.isActive,
  });
  await writeAuditLog({ actorId: adminUserId, action: "reward_campaign_created", module: "RewardsReferrals", targetType: "RewardCampaign", targetId: campaign.id });
  return campaign;
}

export async function updateCampaign(adminUserId: string, id: string, input: Partial<CampaignInput>) {
  await requirePermission(adminUserId, "RewardsReferrals", "Edit");
  if (input.startDate && input.endDate) assertValidRange(input.startDate, input.endDate);

  const campaign = await rewardCampaignRepository.updateCampaign(id, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
    ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
    ...(input.targetCustomerGroup !== undefined ? { targetCustomerGroup: input.targetCustomerGroup } : {}),
    ...(input.pointsMultiplier !== undefined ? { pointsMultiplier: input.pointsMultiplier.toFixed(2) } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
  });
  await writeAuditLog({ actorId: adminUserId, action: "reward_campaign_updated", module: "RewardsReferrals", targetType: "RewardCampaign", targetId: id });
  return campaign;
}
