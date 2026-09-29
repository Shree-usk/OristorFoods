import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardEmptyState } from "@/components/storefront/account/dashboard-empty-state";
import { getSavedRecipesCountForDashboard } from "@/services/customer-dashboard.service";

/** STORY-037. Async Server Component — see recent-orders-card.tsx's header comment for why each widget fetches independently. Count comes from the same service the full /account/saved-recipes page uses, so the two can never drift. */
export async function SavedRecipesCard({ userId }: { userId: string }) {
  const count = await getSavedRecipesCountForDashboard(userId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saved recipes</CardTitle>
      </CardHeader>
      <CardContent>
        {count === 0 ? (
          <DashboardEmptyState message="You haven't saved any recipes yet" ctaLabel="Browse Recipes" ctaHref="/recipes" />
        ) : (
          <div className="flex items-center justify-between gap-4">
            <p className="text-small text-charcoal/70">
              {count} saved recipe{count === 1 ? "" : "s"}
            </p>
            <Link href="/account/saved-recipes" className="text-small text-chilli underline-offset-2 hover:underline">
              View saved recipes
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
