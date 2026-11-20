import type { Metadata } from "next";
import Link from "next/link";

import { Section } from "@/components/storefront/layout/section";
import { buttonVariants } from "@/components/ui/button";
import { getPaymentByReference } from "@/services/payment.service";

export const metadata: Metadata = {
  title: "Payment Status",
  description: "Returning from PayHere checkout.",
  robots: { index: false },
};

/**
 * PayHere's `return_url` fallback (brief requirement) — only ever reached
 * when the onsite JS SDK's popup flow bounces out to a full redirect
 * (e.g. a 3D-Secure challenge, or JS disabled); the normal flow never
 * navigates away from the checkout wizard at all (see
 * payhere-checkout-button.tsx). A browser landing here is NEVER treated
 * as proof of payment — the real, authoritative status is always
 * whatever `notify_url` already wrote to the database, which is all this
 * page reads. The wizard's own client-side Zustand state does not survive
 * a full-page redirect, so this reads `order_id` from the query string,
 * exactly as PayHere echoes back the merchant's own order_id.
 */
export default async function PayHereReturnPage({ searchParams }: { searchParams: Promise<{ order_id?: string }> }) {
  const { order_id: orderId } = await searchParams;
  const payment = orderId ? await getPaymentByReference(orderId) : null;

  return (
    <Section>
      <div className="mx-auto max-w-xl text-center">
        {!payment ? (
          <>
            <h1 className="text-h2 font-heading text-charcoal">Checking your payment…</h1>
            <p className="mt-3 text-body text-charcoal/80">
              We couldn&apos;t find that payment reference. If you completed a payment, check your email or order history —
              you&apos;ll see it there shortly.
            </p>
          </>
        ) : payment.status === "Succeeded" ? (
          <>
            <h1 className="text-h2 font-heading text-charcoal">Payment confirmed</h1>
            <p className="mt-3 text-body text-charcoal/80">Thank you — your payment went through. Continue to finish placing your order.</p>
          </>
        ) : payment.status === "Failed" ? (
          <>
            <h1 className="text-h2 font-heading text-charcoal">Payment not successful</h1>
            <p className="mt-3 text-body text-charcoal/80">
              {payment.failureReason ?? "Your payment could not be completed."} You can try again from checkout.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-h2 font-heading text-charcoal">We&apos;re still confirming your payment</h1>
            <p className="mt-3 text-body text-charcoal/80">This can take a moment. Check your email or order history shortly, or try again below.</p>
          </>
        )}

        <div className="mt-8 flex justify-center gap-3">
          <Link href="/checkout" className={buttonVariants({ variant: "default" })}>
            Back to checkout
          </Link>
          <Link href="/account/orders" className={buttonVariants({ variant: "outline" })}>
            View my orders
          </Link>
        </div>
      </div>
    </Section>
  );
}
