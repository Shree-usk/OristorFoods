import type { Metadata } from "next";

import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PointHistoryTable } from "@/components/storefront/account/point-history-table";
import { RedeemPointsDialog } from "@/components/storefront/account/redeem-points-dialog";
import { TierProgressBar } from "@/components/storefront/account/tier-progress-bar";
import { getPointHistoryPage, getRewardsSummary, getTierProgressForUser, getUpcomingExpiringPoints } from "@/services/customer-rewards-dashboard.service";

export const metadata: Metadata = {
  title: "Rewards",
  robots: { index: false, follow: false },
};

const HISTORY_PAGE_SIZE = 20;

/**
 * STORY-035. Server Component — reads STORY-030's rewards.service.ts
 * directly (no Prisma access here, per the AC). The layout above already
 * guarantees a session exists (STORY-033's guard); this non-null
 * assertion relies on that, same pattern as the dashboard's own page.tsx.
 */
export default async function RewardsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [summary, historyPage] = await Promise.all([getRewardsSummary(userId), getPointHistoryPage(userId, 1, HISTORY_PAGE_SIZE)]);
  const [tierProgress, expiring] = await Promise.all([getTierProgressForUser(summary.lifetimeAchievement), getUpcomingExpiringPoints(userId, summary.spendable)]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h2 font-heading text-charcoal">Rewards</h1>

      {expiring && (
        <div role="status" className="rounded-lg border border-gold bg-cream p-3 text-small text-charcoal">
          {expiring.points.toLocaleString()} points are expiring on {new Date(expiring.expiresAt).toLocaleDateString("en-LK", { dateStyle: "medium" })} — use them before then.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your balance</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-number text-h1 text-charcoal">{summary.spendable.toLocaleString()} pts</p>
              {summary.currentTier && (
                <Badge variant="secondary" className="mt-1">
                  {summary.currentTier.name}
                </Badge>
              )}
            </div>
            <RedeemPointsDialog spendableBalance={summary.spendable} pointsToCurrencyRate={summary.pointsToCurrencyRate} maxRedeemablePointsPerOrder={summary.maxRedeemablePointsPerOrder} />
          </div>
          <TierProgressBar tierProgress={tierProgress} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Point history</CardTitle>
        </CardHeader>
        <CardContent>
          <PointHistoryTable initialData={historyPage} />
        </CardContent>
      </Card>
    </div>
  );
}
