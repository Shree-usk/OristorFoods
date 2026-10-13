"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";

import { AddressStep } from "@/components/storefront/checkout/address-step";
import { CheckoutStepIndicator } from "@/components/storefront/checkout/checkout-step-indicator";
import { DeliveryStep } from "@/components/storefront/checkout/delivery-step";
import { ExportDetailsStep } from "@/components/storefront/checkout/export-details-step";
import { PaymentStep } from "@/components/storefront/checkout/payment-step";
import { ReviewStep } from "@/components/storefront/checkout/review-step";
import { useCart } from "@/hooks/use-cart";
import { CHECKOUT_STEPS, type CheckoutStep, useCheckoutStore } from "@/lib/stores/checkout-store";

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
  const { step, fulfilmentMethod, completedOrderNumber, reset } = useCheckoutStore();

  const cartIsEmpty = !isPending && (!cart || cart.items.length === 0);
  const orderJustPlaced = completedOrderNumber !== null;

  // A completed order left in the store at MOUNT time means a previous
  // visit finished — reset for a fresh attempt. Checked via a ref so it
  // never fires mid-flow: right after placing an order (no remount), the
  // cart query is momentarily still non-empty, and resetting then would
  // clear completedOrderNumber and let the empty-cart redirect win the
  // race against the confirmation navigation.
  const staleCompletionAtMount = useRef(completedOrderNumber !== null);
  useEffect(() => {
    if (staleCompletionAtMount.current) {
      staleCompletionAtMount.current = false;
      reset();
    }
  }, [reset]);

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
  // Story 4 (Payment Restriction), brief Section 6: shown up front — before
  // Address/Delivery — so the customer knows the limited payment choice
  // before reaching the Payment step, not just once they get there.
  const hasRestrictedPayment = cart.items.some((item) => item.packagingOptionId !== null);

  // Export fulfilment flow. Step 1 (Export Details) only ever applies to a
  // cart with an export-declared packaging line — computed at render time
  // (never synced into the store via an effect) so a plain cart's step
  // numbering is unaffected by this field existing at all.
  const requiresExportDetails = cart.items.some((item) => item.packagingDeclaredAvailability === "Export");
  const isPickup = fulfilmentMethod === "Pickup";
  const effectiveStep: CheckoutStep = step === 1 && !requiresExportDetails ? 2 : step;
  const visibleStepNumbers: CheckoutStep[] = requiresExportDetails ? (isPickup ? [1, 4, 5] : [1, 2, 3, 4, 5]) : [2, 3, 4, 5];
  const indicatorSteps = visibleStepNumbers.map((number) => ({ number, label: CHECKOUT_STEPS[number - 1] }));

  return (
    <div className="mt-8">
      <CheckoutStepIndicator currentStep={effectiveStep} steps={indicatorSteps} />
      <p aria-live="polite" className="sr-only">
        Step {indicatorSteps.findIndex((entry) => entry.number === effectiveStep) + 1} of {indicatorSteps.length}: {CHECKOUT_STEPS[effectiveStep - 1]}
      </p>

      {!hasBlockedLines && hasRestrictedPayment && (
        <p className="mt-4 rounded-lg border border-input bg-cream p-4 text-small text-charcoal">
          Your order includes custom packaging, so it must be paid by card or bank transfer.
        </p>
      )}

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
          {effectiveStep === 1 && <ExportDetailsStep />}
          {effectiveStep === 2 && <AddressStep isAuthenticated={status === "authenticated"} />}
          {effectiveStep === 3 && <DeliveryStep />}
          {effectiveStep === 4 && <PaymentStep />}
          {effectiveStep === 5 && <ReviewStep cart={cart} />}
        </div>
      )}
    </div>
  );
}
