import Image from "next/image";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardEmptyState } from "@/components/storefront/account/dashboard-empty-state";
import { getSavedItemsForDashboard } from "@/services/customer-dashboard.service";

/** STORY-033. Async Server Component — see recent-orders-card.tsx's header comment for why each widget fetches independently. */
export async function SavedItemsCard({ userId }: { userId: string }) {
  const { count, preview } = await getSavedItemsForDashboard(userId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saved items</CardTitle>
      </CardHeader>
      <CardContent>
        {count === 0 ? (
          <DashboardEmptyState message="You haven't saved anything yet" ctaLabel="Browse Products" ctaHref="/products" />
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-3">
                {preview.map((item) => (
                  <div key={item.id} className="relative size-12 overflow-hidden rounded-full border-2 border-card bg-cream">
                    <Image src={item.imageSrc} alt={item.imageAlt} fill sizes="48px" className="object-cover" />
                  </div>
                ))}
              </div>
              <p className="text-small text-charcoal/70">
                {count} saved item{count === 1 ? "" : "s"}
              </p>
            </div>
            <Link href="/account/wishlist" className="text-small text-chilli underline-offset-2 hover:underline">
              View wishlist
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
