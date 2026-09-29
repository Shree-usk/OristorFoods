import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderStatusTimeline } from "@/components/storefront/orders/order-status-timeline";
import { ReorderButton } from "@/components/storefront/account/reorder-button";
import { ReturnRequestDialog } from "@/components/storefront/account/return-request-dialog";
import { getOrderDetail } from "@/services/customer-order-history.service";
import { OrderServiceError } from "@/services/order.errors";
import type { OrderDetail } from "@/services/customer-order-history.service";

export const metadata: Metadata = {
  title: "Order Detail",
  robots: { index: false, follow: false },
};

function formatCurrency(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-LK", { dateStyle: "medium" });
}

/**
 * STORY-036. Server Component — reads STORY-028's order data through
 * customer-order-history.service.ts (no Prisma access here, per the AC).
 * A stranger's request or an unknown order number both 404, same as the
 * checkout confirmation page's own handling of OrderServiceError.
 */
export default async function OrderDetailPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const session = await auth();
  const userId = session!.user.id;

  let order: OrderDetail;
  try {
    order = await getOrderDetail(orderNumber, userId);
  } catch (error) {
    if (error instanceof OrderServiceError) notFound();
    throw error;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h2 font-heading text-charcoal">{order.orderNumber}</h1>
          <p className="text-small text-charcoal/70">Placed {formatDate(order.placedAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <a href={`/api/orders/${order.orderNumber}/invoice`} className="text-small font-medium text-chilli underline-offset-2 hover:underline">
            Download invoice
          </a>
          <ReorderButton orderNumber={order.orderNumber} />
          {order.status === "Delivered" && (
            <ReturnRequestDialog
              orderNumber={order.orderNumber}
              items={order.items.map((item) => ({ orderItemId: item.orderItemId, productName: item.productName, quantity: item.quantity }))}
            />
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status &amp; tracking</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderStatusTimeline status={order.status} statusHistory={order.statusHistory} />
          {order.tracking.trackingNumber ? (
            <p className="mt-3 text-small text-charcoal">
              {order.tracking.carrier ?? "Carrier"}: {order.tracking.trackingUrl ? (
                <a href={order.tracking.trackingUrl} className="text-chilli underline-offset-2 hover:underline" target="_blank" rel="noopener noreferrer">
                  {order.tracking.trackingNumber}
                </a>
              ) : (
                order.tracking.trackingNumber
              )}
            </p>
          ) : (
            order.status === "Dispatched" && <p className="mt-3 text-small text-charcoal/70">Tracking details are not yet available.</p>
          )}
          {order.cancellationReason && <p className="mt-3 text-small text-charcoal/70">Cancellation reason: {order.cancellationReason}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y divide-input">
            {order.items.map((item) => (
              <li key={item.orderItemId} className="flex items-center gap-4 py-3">
                {item.imageUrl && (
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-lg">
                    <Image src={item.imageUrl} alt="" fill sizes="56px" className="object-cover" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-medium text-charcoal">{item.productName}</p>
                  <p className="text-small text-charcoal/70">
                    Qty {item.quantity} × {formatCurrency(item.unitPrice, order.currency)}
                  </p>
                </div>
                <p className="font-number text-charcoal">{formatCurrency(item.lineTotal, order.currency)}</p>
              </li>
            ))}
          </ul>

          <dl className="mt-4 flex flex-col gap-1 border-t border-input pt-3 text-body text-charcoal">
            <div className="flex items-center justify-between">
              <dt>Subtotal</dt>
              <dd className="font-number">{formatCurrency(order.subtotal, order.currency)}</dd>
            </div>
            {order.discount > 0 && (
              <div className="flex items-center justify-between text-leaf-dark">
                <dt>{order.discountLabel ?? "Discount"}</dt>
                <dd className="font-number">−{formatCurrency(order.discount, order.currency)}</dd>
              </div>
            )}
            {order.pointsRedemptionValue > 0 && (
              <div className="flex items-center justify-between text-leaf-dark">
                <dt>Points redeemed ({order.pointsRedeemed} pts)</dt>
                <dd className="font-number">−{formatCurrency(order.pointsRedemptionValue, order.currency)}</dd>
              </div>
            )}
            <div className="flex items-center justify-between">
              <dt>Delivery ({order.deliveryZoneName})</dt>
              <dd className="font-number">{order.deliveryCharge === 0 ? "Free" : formatCurrency(order.deliveryCharge, order.currency)}</dd>
            </div>
            {order.tax > 0 && (
              <div className="flex items-center justify-between">
                <dt>Tax</dt>
                <dd className="font-number">{formatCurrency(order.tax, order.currency)}</dd>
              </div>
            )}
            <div className="flex items-center justify-between font-semibold">
              <dt>Total</dt>
              <dd className="font-number">{formatCurrency(order.grandTotal, order.currency)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shipping &amp; payment</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:justify-between">
          <div>
            <p className="text-small font-medium text-charcoal">Shipping address</p>
            <p className="text-small text-charcoal/70">
              {order.shippingAddress.recipientName}, {order.shippingAddress.line1}
              {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ""}, {order.shippingAddress.city}
              {order.shippingAddress.district ? `, ${order.shippingAddress.district}` : ""}
            </p>
          </div>
          {order.payment && (
            <div>
              <p className="text-small font-medium text-charcoal">Payment</p>
              <p className="text-small text-charcoal/70">
                {order.payment.provider} — {order.payment.status}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Link href={`/account/support?order=${order.orderNumber}`} className="text-small font-medium text-chilli underline-offset-2 hover:underline">
        Contact support about this order
      </Link>
    </div>
  );
}
