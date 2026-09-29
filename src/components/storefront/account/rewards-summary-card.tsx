import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardEmptyState } from "@/components/storefront/account/dashboard-empty-state";
import { getRewardsSummaryForDashboard } from "@/services/customer-dashboard.service";

/** STORY-033. Async Server Component — see recent-orders-card.tsx's header comment for why each widget fetches independently. */
export async function RewardsSummaryCard({ userId }: { userId: string }) {
  const balance = await getRewardsSummaryForDashboard(userId);
  const hasActivity = balance.spendable > 0 || balance.lifetimeAchievement > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rewards</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasActivity ? (
          <DashboardEmptyState message="Start earning points on your first order" ctaLabel="Shop Now" ctaHref="/products" />
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-number text-h3 text-charcoal">{balance.spendable.toLocaleString()} pts</p>
              {balance.currentTier && (
                <Badge variant="secondary" className="mt-1">
                  {balance.currentTier.name}
                </Badge>
              )}
            </div>
            <Link href="/account/rewards" className="text-small text-chilli underline-offset-2 hover:underline">
              View rewards
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
