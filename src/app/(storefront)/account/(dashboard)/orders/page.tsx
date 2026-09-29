import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardEmptyState } from "@/components/storefront/account/dashboard-empty-state";
import { OrderFilterBar } from "@/components/storefront/account/order-filter-bar";
import { OrderListItem } from "@/components/storefront/account/order-list-item";
import { getOrderListPage } from "@/services/customer-order-history.service";
import { listOrdersQuerySchema } from "@/validation/order.schema";

export const metadata: Metadata = {
  title: "Orders",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 20;

interface OrdersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function buildPageHref(page: number, status: string | undefined, dateFrom: string | undefined, dateTo: string | undefined): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  params.set("page", String(page));
  return `/account/orders?${params.toString()}`;
}

/** STORY-036. Server Component — reads STORY-028's order data through customer-order-history.service.ts (no Prisma access here, per the AC). Pagination is server-rendered links, same convention as /search's own page.tsx. */
export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const session = await auth();
  const userId = session!.user.id;

  const rawParams = await searchParams;
  const { page, status, dateFrom, dateTo } = listOrdersQuerySchema.parse(rawParams);
  const historyPage = await getOrderListPage(userId, page, PAGE_SIZE, { status, dateFrom, dateTo });

  const statusParam = typeof rawParams.status === "string" ? rawParams.status : undefined;
  const dateFromParam = typeof rawParams.dateFrom === "string" ? rawParams.dateFrom : undefined;
  const dateToParam = typeof rawParams.dateTo === "string" ? rawParams.dateTo : undefined;
  const hasNextPage = page * PAGE_SIZE < historyPage.total;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h2 font-heading text-charcoal">Orders</h1>

      <Card>
        <CardHeader>
          <CardTitle>Your orders</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <OrderFilterBar />
          {historyPage.orders.length === 0 ? (
            <DashboardEmptyState message="No orders yet" ctaLabel="Browse Products" ctaHref="/products" />
          ) : (
            <>
              <ul className="flex flex-col gap-3">
                {historyPage.orders.map((order) => (
                  <OrderListItem key={order.orderNumber} order={order} />
                ))}
              </ul>
              {(page > 1 || hasNextPage) && (
                <div className="flex items-center justify-between text-small">
                  {page > 1 ? (
                    <Link href={buildPageHref(page - 1, statusParam, dateFromParam, dateToParam)} className="font-medium text-chilli underline-offset-2 hover:underline">
                      Previous page
                    </Link>
                  ) : (
                    <span />
                  )}
                  {hasNextPage && (
                    <Link href={buildPageHref(page + 1, statusParam, dateFromParam, dateToParam)} className="font-medium text-chilli underline-offset-2 hover:underline">
                      Next page
                    </Link>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
