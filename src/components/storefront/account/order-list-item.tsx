import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/components/storefront/orders/order-status-timeline";
import { ReorderButton } from "@/components/storefront/account/reorder-button";
import type { OrderHistoryListItem } from "@/services/customer-order-history.service";

function formatCurrency(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-LK", { dateStyle: "medium" });
}

/** STORY-036. One order card in `/account/orders`'s list — reuses STORY-028's STATUS_LABELS so the badge text matches the detail page's timeline. */
export function OrderListItem({ order }: { order: OrderHistoryListItem }) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-input p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {order.thumbnailUrls.length > 0 && (
          <div className="flex -space-x-2">
            {order.thumbnailUrls.map((url, index) => (
              <div key={`${url}-${index}`} className="relative size-12 overflow-hidden rounded-lg border-2 border-background">
                <Image src={url} alt="" fill sizes="48px" className="object-cover" />
              </div>
            ))}
          </div>
        )}
        <div>
          <Link href={`/account/orders/${order.orderNumber}`} className="font-medium text-charcoal hover:underline">
            {order.orderNumber}
          </Link>
          <p className="text-small text-charcoal/70">
            {formatDate(order.placedAt)} · {order.itemCount} item{order.itemCount === 1 ? "" : "s"} · {formatCurrency(order.grandTotal, order.currency)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Badge variant="secondary">{STATUS_LABELS[order.status] ?? order.status}</Badge>
        <Link href={`/account/orders/${order.orderNumber}`} className="text-small font-medium text-chilli underline-offset-2 hover:underline">
          View details
        </Link>
        <ReorderButton orderNumber={order.orderNumber} />
      </div>
    </li>
  );
}
