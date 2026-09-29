import type { RewardTransactionType } from "@/generated/prisma/client";
import * as rewardsRepository from "@/repositories/rewards.repository";
import { getBalanceForUser, type RewardsBalance } from "@/services/rewards.service";

/**
 * STORY-035. Presentation-only composition for `/account/rewards` — reads
 * and formats what STORY-030's rewards.service.ts already computes; no
 * point-earning, tier-threshold, or redemption rule is defined here. Kept
 * separate from STORY-033's customer-dashboard.service.ts, which is
 * scoped to the `/account` summary widgets only, not this full page.
 */

const EXPIRING_SOON_WINDOW_DAYS = 30;

export function getRewardsSummary(userId: string): Promise<RewardsBalance> {
  return getBalanceForUser(userId);
}

export interface PointHistoryRow {
  id: string;
  type: RewardTransactionType;
  points: number;
  createdAt: string;
  /** Spendable balance immediately after this transaction — the AC's "running balance" column. */
  balanceAfter: number;
}

export interface PointHistoryPage {
  rows: PointHistoryRow[];
  total: number;
}

/** See rewards.repository.ts::listAllTransactionsAscending's doc comment for the in-memory-pagination tradeoff this makes. */
export async function getPointHistoryPage(userId: string, page: number, pageSize: number): Promise<PointHistoryPage> {
  const ascending = await rewardsRepository.listAllTransactionsAscending(userId);

  let running = 0;
  const withBalance: PointHistoryRow[] = ascending.map((transaction) => {
    running += transaction.points;
    return { id: transaction.id, type: transaction.type, points: transaction.points, createdAt: transaction.createdAt.toISOString(), balanceAfter: running };
  });

  const newestFirst = withBalance.reverse();
  const start = (page - 1) * pageSize;
  return { rows: newestFirst.slice(start, start + pageSize), total: newestFirst.length };
}

export interface TierProgress {
  currentTier: { id: string; name: string } | null;
  nextTier: { id: string; name: string; minLifetimePoints: number } | null;
  /** 0–100, toward `nextTier`. Null when there's no next tier to progress toward (top tier, or no tiers configured). */
  progressPercent: number | null;
  pointsToNextTier: number | null;
}

/**
 * Pure — takes `tiers` already sorted ascending by minLifetimePoints
 * (rewards.repository.ts::listTiersAscending) rather than fetching them
 * itself, so this is unit-testable without a database.
 */
export function computeTierProgress(lifetimeAchievement: number, tiers: Array<{ id: string; name: string; minLifetimePoints: number }>): TierProgress {
  if (tiers.length === 0) return { currentTier: null, nextTier: null, progressPercent: null, pointsToNextTier: null };

  let currentTier: (typeof tiers)[number] | null = null;
  let nextTier: (typeof tiers)[number] | null = null;
  for (const tier of tiers) {
    if (tier.minLifetimePoints <= lifetimeAchievement) {
      currentTier = tier;
    } else {
      nextTier = tier;
      break;
    }
  }

  if (!nextTier) return { currentTier, nextTier: null, progressPercent: null, pointsToNextTier: null };

  const floor = currentTier?.minLifetimePoints ?? 0;
  const span = nextTier.minLifetimePoints - floor;
  const progressPercent = span > 0 ? Math.max(0, Math.min(100, ((lifetimeAchievement - floor) / span) * 100)) : 0;

  return {
    currentTier,
    nextTier: { id: nextTier.id, name: nextTier.name, minLifetimePoints: nextTier.minLifetimePoints },
    progressPercent,
    pointsToNextTier: Math.max(0, nextTier.minLifetimePoints - lifetimeAchievement),
  };
}

export async function getTierProgressForUser(lifetimeAchievement: number): Promise<TierProgress> {
  const tiers = await rewardsRepository.listTiersAscending();
  return computeTierProgress(lifetimeAchievement, tiers);
}

export interface ExpiringPoints {
  points: number;
  expiresAt: string;
}

/**
 * The nearest-expiring batch within the next 30 days, capped at the
 * customer's current spendable balance — mirrors the sweep's own
 * conservative cap (rewards.service.ts::sweepExpiredPointsForUser) so
 * this can never show more than they actually have. Null when nothing
 * is expiring soon (including when RewardSetting.pointsExpiryDays has
 * never been configured, since then no Earned row ever gets an
 * expiresAt at all).
 */
export async function getUpcomingExpiringPoints(userId: string, spendableBalance: number): Promise<ExpiringPoints | null> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + EXPIRING_SOON_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const batches = await rewardsRepository.findUpcomingUnclosedEarnedBatches(userId, now, windowEnd);
  if (batches.length === 0) return null;

  const totalExpiring = Math.min(
    batches.reduce((sum, batch) => sum + batch.points, 0),
    Math.max(spendableBalance, 0),
  );
  if (totalExpiring <= 0) return null;

  return { points: totalExpiring, expiresAt: batches[0]!.expiresAt!.toISOString() };
}
