import type { Prisma, ReferralAttributionStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** The only place ReferralCode/ReferralAttribution/ReferralSetting Prisma models are queried/mutated. */

type Client = Prisma.TransactionClient | typeof prisma;

export function findCodeByUserId(userId: string, client: Client = prisma) {
  return client.referralCode.findUnique({ where: { userId } });
}

export function findCodeByCode(code: string, client: Client = prisma) {
  return client.referralCode.findUnique({ where: { code }, include: { user: true } });
}

export function createCode(userId: string, code: string, client: Client = prisma) {
  return client.referralCode.create({ data: { userId, code } });
}

export function getSetting(client: Client = prisma) {
  return client.referralSetting.findUnique({ where: { id: "global" } });
}

export function findAttributionByReferredUserId(referredUserId: string, client: Client = prisma) {
  return client.referralAttribution.findUnique({ where: { referredUserId } });
}

export interface CreateAttributionInput {
  referrerUserId: string;
  referredUserId: string;
  status: ReferralAttributionStatus;
  excludedReason?: string | null;
}

export function createAttribution(input: CreateAttributionInput, client: Client = prisma) {
  return client.referralAttribution.create({ data: input });
}

export function markQualified(attributionId: string, qualifyingOrderId: string, client: Client = prisma) {
  return client.referralAttribution.update({
    where: { id: attributionId },
    data: { status: "Qualified", qualifyingOrderId, qualifiedAt: new Date() },
  });
}

/** Reverts a Qualified attribution back to Registered — the qualifying order it was tied to was cancelled. */
export function revertQualification(attributionId: string, client: Client = prisma) {
  return client.referralAttribution.update({
    where: { id: attributionId },
    data: { status: "Registered", qualifyingOrderId: null, qualifiedAt: null },
  });
}

export function findAttributionByQualifyingOrderId(qualifyingOrderId: string, client: Client = prisma) {
  return client.referralAttribution.findFirst({ where: { qualifyingOrderId, status: "Qualified" } });
}

export function listAttributionsForReferrer(referrerUserId: string, client: Client = prisma) {
  return client.referralAttribution.findMany({
    where: { referrerUserId },
    orderBy: { createdAt: "desc" },
    include: { referred: { select: { name: true, email: true } } },
  });
}

/** STORY-039. Dashboard's Rewards & Referrals widget — every referred signup, regardless of status (Qualified/Excluded haven't unhappened as a signup). */
export function countAttributionsSince(from: Date, client: Client = prisma) {
  return client.referralAttribution.count({ where: { createdAt: { gte: from } } });
}

// ---------------------------------------------------------------------------
// STORY-049. Admin Rewards & Referrals console.
// ---------------------------------------------------------------------------

export interface UpdateReferralSettingInput {
  referrerBonusPoints?: number | null;
  minQualifyingOrderValue?: string | null;
  attributionWindowDays?: number | null;
  referredWelcomeBonusPoints?: number | null;
  maxReferralsPerPeriod?: number | null;
  referralPeriodDays?: number | null;
}

/** Singleton upsert by id: "global" — mirrors rewards.repository.ts::updateSetting's own row. */
export function updateSetting(input: UpdateReferralSettingInput, client: Client = prisma) {
  return client.referralSetting.upsert({ where: { id: "global" }, create: { id: "global", ...input }, update: input });
}

/** The referral-velocity fraud check's own count — per referrer, unlike countAttributionsSince's global dashboard count above. */
export function countAttributionsByReferrerSince(referrerUserId: string, since: Date, client: Client = prisma) {
  return client.referralAttribution.count({ where: { referrerUserId, createdAt: { gte: since } } });
}
