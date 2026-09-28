import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Section } from "@/components/storefront/layout/section";
import { buttonVariants } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { CART_COOKIE_NAME } from "@/services/cart.service";
import { getConfirmation } from "@/services/checkout.service";
import { OrderServiceError } from "@/services/order.errors";
import type { OrderConfirmationSummary } from "@/types/checkout";

export const metadata: Metadata = {
  title: "Order Confirmation",
  description: "Your Oristor order has been placed.",
  robots: { index: false },
};

function estimatedWindow(order: OrderConfirmationSummary): string | null {
  const { estimatedDaysMin: min, estimatedDaysMax: max } = order;
  if (min === null && max === null) return null;
  if (min !== null && max !== null) return min === max ? `${min} day${min === 1 ? "" : "s"}` : `${min}–${max} days`;
  const single = min ?? max;
  return `${single} day${single === 1 ? "" : "s"}`;
}

/**
 * Order confirmation (STORY-025; the fuller status pipeline/history view
 * is STORY-028/036). Authorized server-side by the session user or the
 * guest-cart cookie token snapshotted onto the order — a stranger's
 * request 404s rather than confirming the order number exists.
 */
export default async function OrderConfirmationPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const session = await auth();
  const cookieStore = await cookies();
  const guestCookieValue = cookieStore.get(CART_COOKIE_NAME)?.value;

  let order: OrderConfirmationSummary;
  try {
    order = await getConfirmation(orderNumber, session?.user?.id ?? null, guestCookieValue);
  } catch (error) {
    if (error instanceof OrderServiceError) notFound();
    throw error;
  }

  const isGuest = !session?.user?.id;
  const window = estimatedWindow(order);

  return (
    <Section>
      <div className="mx-auto max-w-2xl">
        <p className="text-small font-semibold uppercase tracking-wide text-leaf">Order confirmed</p>
        <h1 className="mt-2 text-h1 font-heading text-charcoal">Thank you for your order!</h1>
        <p className="mt-3 text-body text-charcoal">
          Your order number is <span className="font-number font-semibold">{order.orderNumber}</span>.
          {order.guestEmail && (
            <>
              {" "}
              A confirmation will be sent to <span className="font-semibold">{order.guestEmail}</span>.
            </>
          )}
        </p>

        <section aria-labelledby="confirmation-items" className="mt-8 rounded-lg border border-input p-6">
          <h2 id="confirmation-items" className="text-h4 font-heading text-charcoal">
            Order summary
          </h2>
          <ul className="mt-3 divide-y divide-input">
            {order.items.map((item) => (
              <li key={`${item.productSku}`} className="flex items-center justify-between gap-4 py-2 text-body text-charcoal">
                <span>
                  {item.productName} <span className="text-charcoal/60">× {item.quantity}</span>
                </span>
                <span className="font-number">
                  {order.currency} {item.lineTotal.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 flex flex-col gap-1 border-t border-input pt-3 text-body text-charcoal">
            <div className="flex items-center justify-between">
              <dt>Subtotal</dt>
              <dd className="font-number">
                {order.currency} {order.subtotal.toFixed(2)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Delivery ({order.deliveryZoneName})</dt>
              <dd className="font-number">
                {order.deliveryCharge === 0 ? "Free" : `${order.currency} ${order.deliveryCharge.toFixed(2)}`}
              </dd>
            </div>
            <div className="flex items-center justify-between font-semibold">
              <dt>Total paid</dt>
              <dd className="font-number">
                {order.currency} {order.grandTotal.toFixed(2)}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-small text-charcoal/70">Prices include applicable taxes.</p>
          {order.rewardPointsEarned > 0 && (
            <p className="mt-1 text-small text-charcoal/70">
              You earned <span className="font-number">{order.rewardPointsEarned}</span> reward points with this order.
            </p>
          )}
        </section>

        <section aria-labelledby="confirmation-delivery" className="mt-6 rounded-lg border border-input p-6">
          <h2 id="confirmation-delivery" className="text-h4 font-heading text-charcoal">
            Delivery
          </h2>
          <p className="mt-2 text-body text-charcoal">
            {order.shippingAddress.recipientName}, {order.shippingAddress.line1}
            {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ""}, {order.shippingAddress.city}
            {order.shippingAddress.district ? `, ${order.shippingAddress.district}` : ""}
            {order.shippingAddress.postalCode ? ` ${order.shippingAddress.postalCode}` : ""}
          </p>
          <p className="mt-1 text-small text-charcoal/70">{order.shippingAddress.phone}</p>
          {window && <p className="mt-2 text-small text-charcoal/70">Estimated delivery: {window}</p>}
        </section>

        {isGuest && (
          <section aria-labelledby="confirmation-account" className="mt-6 rounded-lg border border-gold bg-cream p-6">
            <h2 id="confirmation-account" className="text-h4 font-heading text-charcoal">
              Keep track of your orders
            </h2>
            <p className="mt-2 text-body text-charcoal">
              Create an account to see your order history, save addresses, and earn rewards — entirely optional, your
              order is already confirmed.
            </p>
            <Link href="/account/login" className={buttonVariants({ variant: "outline", className: "mt-4" })}>
              Create an account
            </Link>
          </section>
        )}

        <div className="mt-8">
          <Link href="/products" className={buttonVariants({ variant: "default" })}>
            Continue shopping
          </Link>
        </div>
      </div>
    </Section>
  );
}
