import type { Prisma, RewardTransactionType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/**
 * The only place RewardAccount/RewardTransaction/RewardTier/Badge/
 * CustomerBadge/RewardSetting are queried/mutated.
 *
 * Read/flexible functions take an optional trailing `client` (defaulting
 * to plain `prisma`) so a caller can pass a `tx` to read consistently
 * inside a transaction, or omit it for a standalone read — cart.service.ts
 * calls these directly (not through rewards.service.ts) for its own
 * points-preview computation, the same "lower-level shared dependency"
 * role discount.service.ts already plays for coupons, so cart.service.ts
 * and rewards.service.ts never import each other and can't form a cycle.
 * Transaction-mandatory writes (the ledger itself) always require an
 * explicit `tx` first, no default — mirrors coupon.repository.ts's
 * createRedemption.
 */

type Client = Prisma.TransactionClient | typeof prisma;

export function getSetting(client: Client = prisma) {
  return client.rewardSetting.findUnique({ where: { id: "global" } });
}

export async function getOrCreateAccount(client: Client, userId: string) {
  const existing = await client.rewardAccount.findUnique({ where: { userId } });
  if (existing) return existing;
  return client.rewardAccount.create({ data: { userId } });
}

/**
 * Two derived sums from one query — spendableBalance (all transaction
 * types) and lifetimeAchievement (Earned + Reversed only, what tier is
 * evaluated against). See schema.prisma's RewardTransaction doc comment
 * for why these must never be conflated.
 */
export async function getBalances(userId: string, client: Client = prisma): Promise<{ spendable: number; lifetimeAchievement: number }> {
  const rows = await client.rewardTransaction.groupBy({ by: ["type"], where: { userId }, _sum: { points: true } });
  let spendable = 0;
  let lifetimeAchievement = 0;
  for (const row of rows) {
    const sum = row._sum.points ?? 0;
    spendable += sum;
    if (row.type === "Earned" || row.type === "Reversed") lifetimeAchievement += sum;
  }
  return { spendable, lifetimeAchievement };
}

export function findTransactionByOrderAndType(orderId: string, type: RewardTransactionType, client: Client = prisma) {
  return client.rewardTransaction.findUnique({ where: { orderId_type: { orderId, type } } });
}

export interface CreateTransactionInput {
  userId: string;
  type: RewardTransactionType;
  points: number;
  orderId: string | null;
  expiresAt?: Date | null;
  note?: string | null;
}

export function createTransaction(tx: Prisma.TransactionClient, data: CreateTransactionInput) {
  return tx.rewardTransaction.create({ data });
}

/** Written inside order.repository.ts's order-creation transaction — mirrors coupon.repository.ts::createRedemption exactly. */
export function createRedeemedTransaction(tx: Prisma.TransactionClient, input: { userId: string; orderId: string; points: number }) {
  return tx.rewardTransaction.create({ data: { userId: input.userId, orderId: input.orderId, type: "Redeemed", points: -input.points } });
}

/** Closes an Earned batch — sets the Expired row's back-reference in the same write, never a separate update. */
export function createExpiredTransaction(tx: Prisma.TransactionClient, input: { userId: string; earnedTransactionId: string; points: number }) {
  return tx.rewardTransaction.create({
    data: { userId: input.userId, type: "Expired", points: -input.points, expiresEarnedTransactionId: input.earnedTransactionId },
  });
}

/**
 * STORY-035. Every transaction, oldest first, un-paginated — the account
 * page's history table needs a running balance per row, which only a
 * complete ordered read can produce cheaply without a raw-SQL window
 * function (see customer-rewards-dashboard.service.ts::getPointHistoryPage,
 * which computes the cumulative sum and paginates in memory). Fine at
 * this app's scale — a personal ledger, not a shared table — but not a
 * pattern to reuse for anything larger.
 */
export function listAllTransactionsAscending(userId: string, client: Client = prisma) {
  return client.rewardTransaction.findMany({ where: { userId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
}

export async function listTransactionsForUser(userId: string, page: number, pageSize: number) {
  const [rows, total] = await Promise.all([
    prisma.rewardTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.rewardTransaction.count({ where: { userId } }),
  ]);
  return { rows, total };
}

export function listTiersAscending(client: Client = prisma) {
  return client.rewardTier.findMany({ where: { isActive: true }, orderBy: { minLifetimePoints: "asc" } });
}

export function getAccountByUserId(userId: string, client: Client = prisma) {
  return client.rewardAccount.findUnique({ where: { userId } });
}

export function setCurrentTier(userId: string, tierId: string | null, client: Client = prisma) {
  return client.rewardAccount.update({ where: { userId }, data: { currentTierId: tierId } });
}

export function listActiveBadges(client: Client = prisma) {
  return client.badge.findMany({ where: { isActive: true } });
}

export function findAwardedBadge(userId: string, badgeId: string, client: Client = prisma) {
  return client.customerBadge.findUnique({ where: { userId_badgeId: { userId, badgeId } } });
}

export function awardBadge(input: { userId: string; badgeId: string; orderId: string | null }, client: Client = prisma) {
  return client.customerBadge.create({ data: input });
}

/** Earned batches past their expiry that haven't been closed out by an Expired row yet. */
export function findExpiredUnclosedEarnedBatches(userId: string, asOf: Date, client: Client = prisma) {
  return client.rewardTransaction.findMany({
    where: { userId, type: "Earned", expiresAt: { lte: asOf }, expiredBy: null },
    orderBy: { createdAt: "asc" },
  });
}

/** STORY-035. Same shape as findExpiredUnclosedEarnedBatches but for a future window — the "points expiring soon" banner's read, not a new expiry rule. */
export function findUpcomingUnclosedEarnedBatches(userId: string, from: Date, to: Date, client: Client = prisma) {
  return client.rewardTransaction.findMany({
    where: { userId, type: "Earned", expiresAt: { gt: from, lte: to }, expiredBy: null },
    orderBy: { expiresAt: "asc" },
  });
}

/** STORY-035. Net signed sum across the given types — e.g. ReferralBonus + ReferralBonusReversed for "total referral rewards earned" on the /account/referrals page. */
export async function sumPointsByTypes(userId: string, types: RewardTransactionType[], client: Client = prisma): Promise<number> {
  const rows = await client.rewardTransaction.groupBy({ by: ["type"], where: { userId, type: { in: types } }, _sum: { points: true } });
  return rows.reduce((sum, row) => sum + (row._sum.points ?? 0), 0);
}

export function getAccountWithTier(userId: string) {
  return prisma.rewardAccount.findUnique({ where: { userId }, include: { currentTier: true } });
}

/** STORY-039. Dashboard's Rewards & Referrals widget. */
export function countRedemptionsSince(from: Date, client: Client = prisma) {
  return client.rewardTransaction.count({ where: { type: "Redeemed", createdAt: { gte: from } } });
}
