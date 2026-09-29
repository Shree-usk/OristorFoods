// @vitest-environment node
import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  computeTierProgress,
  getPointHistoryPage,
  getUpcomingExpiringPoints,
} from "@/services/customer-rewards-dashboard.service";

const EMAIL_PREFIX = "rwd-dash-svc-";
let sequence = 0;

async function makeUser() {
  sequence += 1;
  return prisma.user.create({ data: { email: `${EMAIL_PREFIX}${sequence}@test.com` } });
}

describe("customer-rewards-dashboard.service", () => {
  describe("computeTierProgress (pure)", () => {
    const tiers = [
      { id: "bronze", name: "Bronze", minLifetimePoints: 0 },
      { id: "silver", name: "Silver", minLifetimePoints: 500 },
      { id: "gold", name: "Gold", minLifetimePoints: 2000 },
    ];

    it("computes progress toward the next tier from partway through the current one", () => {
      const result = computeTierProgress(750, tiers);
      expect(result.currentTier?.id).toBe("silver");
      expect(result.nextTier?.id).toBe("gold");
      // (750 - 500) / (2000 - 500) = 250/1500 ≈ 16.67%
      expect(result.progressPercent).toBeCloseTo(16.67, 1);
      expect(result.pointsToNextTier).toBe(1250);
    });

    it("returns no next tier once the top tier is reached", () => {
      const result = computeTierProgress(5000, tiers);
      expect(result.currentTier?.id).toBe("gold");
      expect(result.nextTier).toBeNull();
      expect(result.progressPercent).toBeNull();
    });

    it("progresses toward the first tier when below every threshold", () => {
      const tiersWithNonzeroFloor = [
        { id: "bronze", name: "Bronze", minLifetimePoints: 200 },
        { id: "silver", name: "Silver", minLifetimePoints: 500 },
      ];
      const result = computeTierProgress(100, tiersWithNonzeroFloor);
      expect(result.currentTier).toBeNull();
      expect(result.nextTier?.id).toBe("bronze");
      // (100 - 0) / (200 - 0) = 50%
      expect(result.progressPercent).toBe(50);
      expect(result.pointsToNextTier).toBe(100);
    });

    it("returns nulls when no tiers are configured", () => {
      const result = computeTierProgress(100, []);
      expect(result).toEqual({ currentTier: null, nextTier: null, progressPercent: null, pointsToNextTier: null });
    });
  });

  describe("getPointHistoryPage", () => {
    it("computes a running balance newest-first and paginates in memory", async () => {
      const user = await makeUser();
      const base = new Date("2026-01-01T00:00:00.000Z");
      await prisma.rewardTransaction.create({ data: { userId: user.id, type: "Earned", points: 100, orderId: null, createdAt: new Date(base.getTime() + 1000) } });
      await prisma.rewardTransaction.create({ data: { userId: user.id, type: "Earned", points: 50, orderId: null, createdAt: new Date(base.getTime() + 2000) } });
      await prisma.rewardTransaction.create({ data: { userId: user.id, type: "Redeemed", points: -30, orderId: null, createdAt: new Date(base.getTime() + 3000) } });

      const page = await getPointHistoryPage(user.id, 1, 20);
      expect(page.total).toBe(3);
      // Newest first: Redeemed(-30, balance 120), Earned(+50, balance 150), Earned(+100, balance 100).
      expect(page.rows.map((r) => ({ points: r.points, balanceAfter: r.balanceAfter }))).toEqual([
        { points: -30, balanceAfter: 120 },
        { points: 50, balanceAfter: 150 },
        { points: 100, balanceAfter: 100 },
      ]);
    });

    it("paginates correctly across a page boundary", async () => {
      const user = await makeUser();
      for (let i = 0; i < 5; i += 1) {
        await prisma.rewardTransaction.create({ data: { userId: user.id, type: "Earned", points: 10, orderId: null } });
      }
      const firstPage = await getPointHistoryPage(user.id, 1, 2);
      const secondPage = await getPointHistoryPage(user.id, 2, 2);
      expect(firstPage.rows).toHaveLength(2);
      expect(secondPage.rows).toHaveLength(2);
      expect(firstPage.total).toBe(5);
    });
  });

  describe("getUpcomingExpiringPoints", () => {
    it("returns the total expiring within the next 30 days, capped at the current spendable balance", async () => {
      const user = await makeUser();
      const soon = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      await prisma.rewardTransaction.create({ data: { userId: user.id, type: "Earned", points: 200, orderId: null, expiresAt: soon } });

      const result = await getUpcomingExpiringPoints(user.id, 150);
      expect(result).not.toBeNull();
      expect(result?.points).toBe(150); // capped at the passed-in spendable balance
    });

    it("returns null when nothing expires within the window", async () => {
      const user = await makeUser();
      const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      await prisma.rewardTransaction.create({ data: { userId: user.id, type: "Earned", points: 100, orderId: null, expiresAt: farFuture } });

      const result = await getUpcomingExpiringPoints(user.id, 100);
      expect(result).toBeNull();
    });

    it("returns null when no Earned rows have an expiresAt at all", async () => {
      const user = await makeUser();
      await prisma.rewardTransaction.create({ data: { userId: user.id, type: "Earned", points: 100, orderId: null } });

      const result = await getUpcomingExpiringPoints(user.id, 100);
      expect(result).toBeNull();
    });
  });
});
