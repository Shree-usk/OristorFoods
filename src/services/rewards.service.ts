import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import * as cartRepository from "@/repositories/cart.repository";
import * as orderRepository from "@/repositories/order.repository";
import * as rewardsRepository from "@/repositories/rewards.repository";
import { getCartSummaryById } from "@/services/cart.service";
import type { OrderEventConsumer } from "@/services/order-integration.service";
import { calculatePointsRedemption } from "@/services/rewards-calc";
import type { PointsRedemptionCalcResult } from "@/services/rewards-calc";
import {
  RewardsExceedsPerOrderCapError,
  RewardsInsufficientBalanceError,
  RewardsInvalidAmountError,
  RewardsNotAuthenticatedError,
  RewardsRedemptionUnavailableError,
} from "@/services/rewards.errors";
import type { CartSummary } from "@/types/cart";

/**
 * Rewards / Loyalty Club (STORY-030): the ledger-backed points wallet,
 * tier/badge progression, and points redemption at checkout. The earning
 * AMOUNT itself (Product.rewardPoints -> Order.rewardPointsEarned) is
 * already computed by cart.service.ts/checkout.service.ts (STORY-024/025)
 * — this file owns what happens to that number afterward: crediting it
 * on order.confirmed, clawing it back on order.cancelled (STORY-028's
 * event hook), tier/badge evaluation, and redemption.
 *
 * Layering note: this file may import cart.service.ts (for
 * getCartSummaryById, in applyPointsToCart/removePointsFromCart below).
 * cart.service.ts, in turn, reads rewards.repository.ts + rewards-calc.ts
 * DIRECTLY for its own points-preview computation — never this file — so
 * the two services can never form an import cycle. This mirrors exactly
 * how discount.service.ts is the shared lower-level dependency both
 * cart.service.ts and coupon.service.ts depend on without cart.service.ts
 * and coupon.service.ts importing each other.
 */

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// --- order.confirmed / order.cancelled consumer (STORY-028's hook) ---
//
// registerOrderEventConsumer (order-integration.service.ts) fans out to
// every registered consumer (STORY-031 fixed the single-slot design this
// comment used to warn about) — this module is one of possibly several.

export const rewardsConsumer: OrderEventConsumer = {
  async onOrderEvent(_eventId, type, orderId, payload) {
    const userId = typeof payload.userId === "string" ? payload.userId : null;
    if (!userId) return; // guest order — no ledger to credit
    if (type === "order.confirmed") {
      const points = typeof payload.rewardPointsEarned === "number" ? payload.rewardPointsEarned : 0;
      await creditPointsForConfirmedOrder(orderId, userId, points);
    } else if (type === "order.cancelled") {
      await reversePointsForCancelledOrder(orderId, userId);
    }
  },
};

export async function creditPointsForConfirmedOrder(orderId: string, userId: string, points: number): Promise<void> {
  if (points > 0) {
    const setting = await rewardsRepository.getSetting();
    const expiresAt = setting?.pointsExpiryDays ? addDays(new Date(), setting.pointsExpiryDays) : null;
    try {
      await prisma.$transaction(async (tx) => {
        await rewardsRepository.getOrCreateAccount(tx, userId);
        await rewardsRepository.createTransaction(tx, { userId, type: "Earned", points, orderId, expiresAt });
      });
    } catch (error) {
      // Already credited (a replayed event) — idempotent no-op, matches
      // the @@unique([orderId, type]) constraint's purpose exactly.
      if (!isUniqueConstraintViolation(error)) throw error;
    }
  }
  // Runs even when points === 0 — a badge like first_order depends on
  // order count, not points earned.
  await evaluateTierAndBadges(userId, orderId);
}

export async function reversePointsForCancelledOrder(orderId: string, userId: string): Promise<void> {
  const earned = await rewardsRepository.findTransactionByOrderAndType(orderId, "Earned");
  if (earned && earned.points > 0) {
    try {
      await prisma.$transaction(async (tx) => {
        await rewardsRepository.createTransaction(tx, { userId, type: "Reversed", points: -earned.points, orderId });
      });
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
    }
  }
  // Clawback can cross a tier boundary downward — re-evaluate either way.
  await evaluateTierAndBadges(userId, orderId);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Recomputes lifetimeAchievement, updates the cached current tier if it
 * changed, then checks every active badge the customer hasn't already
 * earned. Badges, once earned, are never revoked (unlike points) — see
 * docs/architecture-decisions.md.
 */
async function evaluateTierAndBadges(userId: string, orderId: string | null): Promise<void> {
  await rewardsRepository.getOrCreateAccount(prisma, userId);
  const { lifetimeAchievement } = await rewardsRepository.getBalances(userId);

  const tiers = await rewardsRepository.listTiersAscending();
  let matchedTierId: string | null = null;
  for (const tier of tiers) {
    if (tier.minLifetimePoints <= lifetimeAchievement) matchedTierId = tier.id;
  }
  const account = await rewardsRepository.getAccountByUserId(userId);
  if (account && account.currentTierId !== matchedTierId) {
    await rewardsRepository.setCurrentTier(userId, matchedTierId);
  }

  const badges = await rewardsRepository.listActiveBadges();
  if (badges.length === 0) return;
  const orderCount = await orderRepository.countOrdersByUserId(userId);
  for (const badge of badges) {
    const already = await rewardsRepository.findAwardedBadge(userId, badge.id);
    if (already) continue;
    if (!badgeCriteriaMet(badge, { orderCount, lifetimeAchievement })) continue;
    try {
      await rewardsRepository.awardBadge({ userId, badgeId: badge.id, orderId });
    } catch (error) {
      // A concurrent evaluation already awarded it — @@unique([userId, badgeId]) guards this.
      if (!isUniqueConstraintViolation(error)) throw error;
    }
  }
}

/** Fails safe (never awarded) for an unrecognized criteriaType — matches the fail-safe requirement for missing/unknown admin config. */
function badgeCriteriaMet(badge: { criteriaType: string; threshold: number | null }, context: { orderCount: number; lifetimeAchievement: number }): boolean {
  switch (badge.criteriaType) {
    case "first_order":
      return context.orderCount === 1;
    case "order_count":
      return badge.threshold !== null && context.orderCount >= badge.threshold;
    case "lifetime_points":
      return badge.threshold !== null && context.lifetimeAchievement >= badge.threshold;
    default:
      return false;
  }
}

/**
 * Lazy, on-read expiry sweep — deliberately simplified (not perfect FIFO
 * batch attribution): each Earned batch past its own expiresAt closes
 * with an Expired row for min(that batch's original points, the
 * customer's CURRENT spendable balance) — capped so it can never drive
 * the balance negative even if part of that batch was already spent.
 * Off entirely (no-op) whenever no Earned rows have an expiresAt set,
 * i.e. RewardSetting.pointsExpiryDays has never been configured — the
 * default, since no admin UI exists yet to turn it on. See
 * docs/architecture-decisions.md.
 */
async function sweepExpiredPointsForUser(userId: string, now: Date = new Date()): Promise<void> {
  const stale = await rewardsRepository.findExpiredUnclosedEarnedBatches(userId, now);
  for (const batch of stale) {
    try {
      await prisma.$transaction(async (tx) => {
        const { spendable } = await rewardsRepository.getBalances(userId, tx);
        const expireAmount = Math.min(batch.points, Math.max(spendable, 0));
        await rewardsRepository.createExpiredTransaction(tx, { userId, earnedTransactionId: batch.id, points: expireAmount });
      });
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
    }
  }
}

// --- Reads (STORY-035's future dashboard, and the checkout Review step) ---

export interface RewardsBalance {
  spendable: number;
  lifetimeAchievement: number;
  currentTier: { id: string; name: string } | null;
  pointsToCurrencyRate: number | null;
  maxRedeemablePointsPerOrder: number | null;
}

export async function getBalanceForUser(userId: string): Promise<RewardsBalance> {
  await sweepExpiredPointsForUser(userId);
  const [balances, account, setting] = await Promise.all([
    rewardsRepository.getBalances(userId),
    rewardsRepository.getAccountWithTier(userId),
    rewardsRepository.getSetting(),
  ]);
  return {
    spendable: balances.spendable,
    lifetimeAchievement: balances.lifetimeAchievement,
    currentTier: account?.currentTier ? { id: account.currentTier.id, name: account.currentTier.name } : null,
    pointsToCurrencyRate: setting?.pointsToCurrencyRate?.toNumber() ?? null,
    maxRedeemablePointsPerOrder: setting?.maxRedeemablePointsPerOrder ?? null,
  };
}

export function listTransactionsForUser(userId: string, page: number, pageSize: number) {
  return rewardsRepository.listTransactionsForUser(userId, page, pageSize);
}

// --- Redemption at checkout ---

/**
 * Silent-skip read for the payment-intent amount — never throws (a
 * guest, a zero request, or an unconfigured rate all just mean "no
 * redemption applies"). Mirrors discount.service.ts::resolveDiscountForCart.
 */
export async function resolvePointsRedemptionForCart(userId: string | null, pointsRequested: number, payableBeforePoints: number): Promise<PointsRedemptionCalcResult> {
  if (!userId || !Number.isInteger(pointsRequested) || pointsRequested <= 0) return { pointsToRedeem: 0, discountValue: 0 };
  const [setting, balances] = await Promise.all([rewardsRepository.getSetting(), rewardsRepository.getBalances(userId)]);
  return calculatePointsRedemption({
    pointsRequested,
    spendableBalance: balances.spendable,
    pointsToCurrencyRate: setting?.pointsToCurrencyRate?.toNumber() ?? null,
    maxRedeemablePointsPerOrder: setting?.maxRedeemablePointsPerOrder ?? null,
    payableBeforePoints,
  });
}

/**
 * Final, THROWING re-validation — checkout.service.ts::placeOrder's last
 * word before committing. Mirrors coupon.service.ts::validateCoupon's
 * relationship to resolveDiscountForCart's silent read.
 */
export async function validateRedemptionAtPlaceOrder(userId: string, pointsRequested: number, payableBeforePoints: number): Promise<PointsRedemptionCalcResult> {
  if (!Number.isInteger(pointsRequested) || pointsRequested <= 0) return { pointsToRedeem: 0, discountValue: 0 };
  await sweepExpiredPointsForUser(userId);

  const setting = await rewardsRepository.getSetting();
  const rate = setting?.pointsToCurrencyRate?.toNumber() ?? null;
  if (rate === null || rate <= 0) throw new RewardsRedemptionUnavailableError();

  const { spendable } = await rewardsRepository.getBalances(userId);
  if (pointsRequested > spendable) throw new RewardsInsufficientBalanceError(pointsRequested, spendable);
  if (setting?.maxRedeemablePointsPerOrder !== null && setting?.maxRedeemablePointsPerOrder !== undefined && pointsRequested > setting.maxRedeemablePointsPerOrder) {
    throw new RewardsExceedsPerOrderCapError(pointsRequested, setting.maxRedeemablePointsPerOrder);
  }

  return calculatePointsRedemption({
    pointsRequested,
    spendableBalance: spendable,
    pointsToCurrencyRate: rate,
    maxRedeemablePointsPerOrder: setting?.maxRedeemablePointsPerOrder ?? null,
    payableBeforePoints,
  });
}

/**
 * Sets how many points the customer wants to redeem on their cart —
 * validated immediately (balance, per-order cap, rate configured) for
 * fast feedback, same as applying a coupon. Authenticated only: a guest
 * has no ledger, so this looks the customer's cart up directly by userId
 * (cartRepository.findCartByUserId) rather than going through
 * cart.service.ts's guest-aware identity resolution.
 */
export async function applyPointsToCart(userId: string | null, pointsRequested: number): Promise<CartSummary> {
  if (!userId) throw new RewardsNotAuthenticatedError();
  if (!Number.isInteger(pointsRequested) || pointsRequested <= 0) throw new RewardsInvalidAmountError();

  const setting = await rewardsRepository.getSetting();
  const rate = setting?.pointsToCurrencyRate?.toNumber() ?? null;
  if (rate === null || rate <= 0) throw new RewardsRedemptionUnavailableError();

  const { spendable } = await rewardsRepository.getBalances(userId);
  if (pointsRequested > spendable) throw new RewardsInsufficientBalanceError(pointsRequested, spendable);
  if (setting?.maxRedeemablePointsPerOrder !== null && setting?.maxRedeemablePointsPerOrder !== undefined && pointsRequested > setting.maxRedeemablePointsPerOrder) {
    throw new RewardsExceedsPerOrderCapError(pointsRequested, setting.maxRedeemablePointsPerOrder);
  }

  const cart = await cartRepository.findCartByUserId(userId);
  if (!cart) throw new RewardsRedemptionUnavailableError();
  await cartRepository.setCartPointsToRedeem(cart.id, pointsRequested);
  return getCartSummaryById(cart.id, userId);
}

export async function removePointsFromCart(userId: string | null): Promise<CartSummary> {
  if (!userId) throw new RewardsNotAuthenticatedError();
  const cart = await cartRepository.findCartByUserId(userId);
  if (!cart) throw new RewardsRedemptionUnavailableError();
  await cartRepository.setCartPointsToRedeem(cart.id, 0);
  return getCartSummaryById(cart.id, userId);
}
