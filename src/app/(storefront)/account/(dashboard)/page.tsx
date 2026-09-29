import type { Metadata } from "next";
import { Suspense } from "react";

import { auth } from "@/lib/auth";
import { DashboardCardSkeleton } from "@/components/storefront/account/dashboard-card-skeleton";
import { QuickLinksCard } from "@/components/storefront/account/quick-links-card";
import { RecentOrdersCard } from "@/components/storefront/account/recent-orders-card";
import { RewardsSummaryCard } from "@/components/storefront/account/rewards-summary-card";
import { SavedItemsCard } from "@/components/storefront/account/saved-items-card";
import { SavedRecipesCard } from "@/components/storefront/account/saved-recipes-card";

export const metadata: Metadata = {
  title: "My Account",
  robots: { index: false, follow: false },
};

/**
 * STORY-033. The layout above already guarantees a session exists — this
 * `session!.user.id` non-null assertion relies on that guard, never on
 * this page re-checking it. Each widget is its own async Server Component
 * inside its own <Suspense>, so a slow fetch in one never blocks another
 * (per the story's AC) — see customer-dashboard.service.ts.
 */
export default async function AccountDashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  return (
    <div>
      <h1 className="text-h2 font-heading text-charcoal">Welcome back{session!.user.name ? `, ${session!.user.name}` : ""}</h1>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Suspense fallback={<DashboardCardSkeleton title="Recent orders" />}>
          <RecentOrdersCard userId={userId} />
        </Suspense>
        <Suspense fallback={<DashboardCardSkeleton title="Rewards" />}>
          <RewardsSummaryCard userId={userId} />
        </Suspense>
        <Suspense fallback={<DashboardCardSkeleton title="Saved items" />}>
          <SavedItemsCard userId={userId} />
        </Suspense>
        <Suspense fallback={<DashboardCardSkeleton title="Saved recipes" />}>
          <SavedRecipesCard userId={userId} />
        </Suspense>
        <QuickLinksCard />
      </div>
    </div>
  );
}
