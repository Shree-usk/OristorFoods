import type { Metadata } from "next";
import Link from "next/link";

import { Section } from "@/components/storefront/layout/section";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Payment Cancelled",
  description: "Payment was cancelled before completion.",
  robots: { index: false },
};

/**
 * PayHere's `cancel_url` fallback (brief requirement) — only reached if
 * the onsite JS SDK's popup flow bounces out to a full redirect instead
 * of firing `onDismissed` in-page (see payhere-checkout-button.tsx,
 * which handles the normal case). Nothing to look up here: a cancel
 * means no payment was attempted, so there is no Payment status to read.
 * The cart itself is untouched either way.
 */
export default function PayHereCancelPage() {
  return (
    <Section>
      <div className="mx-auto max-w-xl text-center">
        <h1 className="text-h2 font-heading text-charcoal">Payment cancelled</h1>
        <p className="mt-3 text-body text-charcoal/80">
          You cancelled before completing payment — nothing was charged. Your cart is still here whenever you&apos;re ready.
        </p>
        <div className="mt-8 flex justify-center">
          <Link href="/checkout" className={buttonVariants({ variant: "default" })}>
            Back to checkout
          </Link>
        </div>
      </div>
    </Section>
  );
}
