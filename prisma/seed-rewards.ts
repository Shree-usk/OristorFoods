import { prisma } from "../src/lib/db";

/**
 * Rewards / Loyalty Club seed (STORY-030). Tiers are seeded because tier
 * progression needs *some* thresholds to mean anything — unlike coupons,
 * which are meaningless until an admin deliberately creates one.
 * Deliberately NO RewardSetting row: leaving it absent keeps point
 * redemption and expiry off by default (see rewards.service.ts and
 * docs/architecture-decisions.md), since no admin UI exists yet to turn
 * them on. The admin CRUD for tiers/badges/settings is STORY-049.
 */
export async function seedRewards() {
  await prisma.rewardTier.createMany({
    data: [
      { name: "Bronze", minLifetimePoints: 0, sortOrder: 1 },
      { name: "Silver", minLifetimePoints: 1000, sortOrder: 2 },
      { name: "Gold", minLifetimePoints: 5000, sortOrder: 3 },
    ],
  });

  await prisma.badge.createMany({
    data: [
      { code: "first_order", name: "First Order", description: "Placed your first order with Oristor.", criteriaType: "first_order" },
      { code: "loyal_customer", name: "Loyal Customer", description: "Placed 5 orders with Oristor.", criteriaType: "order_count", threshold: 5 },
    ],
  });

  return { tiers: 3, badges: 2 };
}
