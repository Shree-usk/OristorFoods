import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_LABELS } from "@/components/storefront/orders/order-status-timeline";
import { DashboardEmptyState } from "@/components/storefront/account/dashboard-empty-state";
import { getRecentOrdersForDashboard } from "@/services/customer-dashboard.service";

function formatCurrency(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** STORY-033. Async Server Component — awaited inside its own <Suspense> boundary on the dashboard page so a slow fetch here never blocks the other widgets. */
export async function RecentOrdersCard({ userId }: { userId: string }) {
  const orders = await getRecentOrdersForDashboard(userId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent orders</CardTitle>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <DashboardEmptyState message="No orders yet" ctaLabel="Shop Now" ctaHref="/products" />
        ) : (
          <ul className="flex flex-col gap-1">
            {orders.map((order) => (
              <li key={order.orderNumber}>
                <Link
                  href={`/account/orders/${order.orderNumber}`}
                  className="flex items-center justify-between gap-4 rounded-lg p-2 -mx-2 hover:bg-muted"
                >
                  <div>
                    <p className="font-medium text-charcoal">{order.orderNumber}</p>
                    <p className="text-small text-charcoal/70">
                      {order.itemCount} item{order.itemCount === 1 ? "" : "s"} · {formatCurrency(order.grandTotal, order.currency)}
                    </p>
                  </div>
                  <Badge variant="secondary">{STATUS_LABELS[order.status] ?? order.status}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
