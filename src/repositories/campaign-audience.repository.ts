import type { CustomerGroup, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/**
 * STORY-050d. Bulk recipient-pool lookups for a campaign's audience
 * segment — resolved once per send, cross-referenced against
 * NotificationPreference/User.marketingOptIn by
 * email-sms-campaign.service.ts for actual consent/contact filtering.
 */

type Client = Prisma.TransactionClient | typeof prisma;

export interface CampaignRecipientCandidate {
  id: string;
  name: string | null;
  email: string | null;
  marketingOptIn: boolean;
  notificationPreference: { phone: string | null; smsOptIn: boolean; whatsappOptIn: boolean } | null;
}

const candidateSelect = {
  id: true,
  name: true,
  email: true,
  marketingOptIn: true,
  notificationPreference: { select: { phone: true, smsOptIn: true, whatsappOptIn: true } },
} satisfies Prisma.UserSelect;

export function listAllCustomers(client: Client = prisma): Promise<CampaignRecipientCandidate[]> {
  return client.user.findMany({ select: candidateSelect });
}

export function listCustomersByGroup(group: CustomerGroup, client: Client = prisma): Promise<CampaignRecipientCandidate[]> {
  return client.user.findMany({ where: { customerGroup: group }, select: candidateSelect });
}

/** The bulk form of rewards.repository.ts::getBalances's lifetimeAchievement (Earned + Reversed, summed positive). */
export async function listLoyaltyMemberUserIds(client: Client = prisma): Promise<string[]> {
  const rows = await client.rewardTransaction.groupBy({ by: ["userId"], where: { type: { in: ["Earned", "Reversed"] } }, _sum: { points: true } });
  return rows.filter((row) => (row._sum.points ?? 0) > 0).map((row) => row.userId);
}

/** Has referred (referrerUserId) or been referred (referredUserId) — the bulk form of popup.service.ts::matchesAudience's ReferralMembers check. */
export async function listReferralMemberUserIds(client: Client = prisma): Promise<string[]> {
  const [asReferrer, asReferred] = await Promise.all([
    client.referralAttribution.findMany({ distinct: ["referrerUserId"], select: { referrerUserId: true } }),
    client.referralAttribution.findMany({ distinct: ["referredUserId"], select: { referredUserId: true } }),
  ]);
  return [...new Set([...asReferrer.map((row) => row.referrerUserId), ...asReferred.map((row) => row.referredUserId)])];
}

export function listCustomersByIds(ids: string[], client: Client = prisma): Promise<CampaignRecipientCandidate[]> {
  return client.user.findMany({ where: { id: { in: ids } }, select: candidateSelect });
}
