"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

import { AddressStep } from "@/components/storefront/checkout/address-step";
import { CheckoutStepIndicator } from "@/components/storefront/checkout/checkout-step-indicator";
import { DeliveryStep } from "@/components/storefront/checkout/delivery-step";
import { PaymentStep } from "@/components/storefront/checkout/payment-step";
import { ReviewStep } from "@/components/storefront/checkout/review-step";
import { useCart } from "@/hooks/use-cart";
import { CHECKOUT_STEPS, useCheckoutStore } from "@/lib/stores/checkout-store";

/**
 * The four-step checkout wizard (STORY-025). Wizard state is client-held
 * by design (no CheckoutSession table) — a refresh returns the customer
 * to step 1 with their server-side cart intact. Checkout is only
 * reachable with a non-empty, valid cart; an empty one redirects to /cart.
 */
export function CheckoutWizard() {
  const router = useRouter();
  const { status } = useSession();
  const { cart, isPending } = useCart();
  const { step, completedOrderNumber, reset } = useCheckoutStore();

  const cartIsEmpty = !isPending && (!cart || cart.items.length === 0);
  const orderJustPlaced = completedOrderNumber !== null;

  // A previous visit finished an order: this is a fresh checkout attempt.
  useEffect(() => {
    if (orderJustPlaced && cartIsEmpty === false) reset();
  }, [orderJustPlaced, cartIsEmpty, reset]);

  useEffect(() => {
    if (cartIsEmpty && !orderJustPlaced) router.replace("/cart");
  }, [cartIsEmpty, orderJustPlaced, router]);

  if (isPending || status === "loading") {
    return <p className="mt-8 text-body text-charcoal/70">Loading checkout…</p>;
  }

  if (orderJustPlaced) {
    return (
      <p role="status" className="mt-8 text-body text-charcoal">
        Order placed — taking you to your confirmation…
      </p>
    );
  }

  if (cartIsEmpty || !cart) {
    return <p className="mt-8 text-body text-charcoal/70">Your cart is empty — redirecting…</p>;
  }

  const hasBlockedLines = cart.items.some((item) => item.unavailable || item.quantityCapped);

  return (
    <div className="mt-8">
      <CheckoutStepIndicator currentStep={step} />
      <p aria-live="polite" className="sr-only">
        Step {step} of {CHECKOUT_STEPS.length}: {CHECKOUT_STEPS[step - 1]}
      </p>

      {hasBlockedLines ? (
        <p role="alert" className="mt-8 rounded-lg border border-gold bg-cream p-4 text-body text-charcoal">
          Some items in your cart are unavailable or exceed current stock. Please{" "}
          <a href="/cart" className="text-chilli underline-offset-2 hover:underline">
            review your cart
          </a>{" "}
          before checking out.
        </p>
      ) : (
        <div className="mt-8 max-w-2xl">
          {step === 1 && <AddressStep isAuthenticated={status === "authenticated"} />}
          {step === 2 && <DeliveryStep />}
          {step === 3 && <PaymentStep />}
          {step === 4 && <ReviewStep cart={cart} />}
        </div>
      )}
    </div>
  );
}
