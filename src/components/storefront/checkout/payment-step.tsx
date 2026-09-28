"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/api-error";
import { confirmPayment, createPaymentIntent } from "@/lib/api/checkout-client";
import { useCheckoutStore } from "@/lib/stores/checkout-store";

/**
 * Step 3: provider-agnostic method selection (STORY-026). Until the real
 * gateway decision (blueprint Section 10), the only methods are the mock
 * provider's simulated outcomes — which also exercise the exact
 * success/decline/retry paths a real hosted checkout will use. The
 * payment amount is created server-side from the live cart + delivery
 * charge; nothing here sends a total.
 */
const PAYMENT_METHODS = [
  { outcome: "success" as const, label: "Mock payment — Success", description: "Simulates an approved payment (dev/test only)." },
  { outcome: "decline" as const, label: "Mock payment — Decline", description: "Simulates a declined payment (dev/test only)." },
];

export function PaymentStep() {
  const { address, intent, setIntent, markPaymentConfirmed, goToStep } = useCheckoutStore();
  const [selectedOutcome, setSelectedOutcome] = useState<"success" | "decline">("success");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  async function handlePay() {
    if (!address) return;
    setIsProcessing(true);
    setPaymentError(null);
    try {
      // A fresh intent per attempt: a declined intent's Payment row stays
      // Failed and can't be resurrected (payment.service.ts), so retrying
      // always starts clean at the current server-computed amount.
      const freshIntent = await createPaymentIntent(address.city);
      setIntent(freshIntent);

      const result = await confirmPayment(freshIntent.providerReference, selectedOutcome);
      if (result.status === "Succeeded") {
        markPaymentConfirmed();
        goToStep(4);
      } else {
        setPaymentError(result.failureReason ?? "Your payment was declined. Please try another method.");
      }
    } catch (error) {
      setPaymentError(error instanceof ApiError ? error.message : "The payment could not be processed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div>
      <h2 className="text-h3 font-heading text-charcoal">Payment</h2>
      {intent && (
        <p className="mt-2 text-small text-charcoal/70">
          Amount to pay: <span className="font-number font-semibold text-charcoal">LKR {intent.amount.toFixed(2)}</span>
        </p>
      )}

      <fieldset className="mt-6">
        <legend className="text-small font-semibold text-charcoal">Choose a payment method</legend>
        <div className="mt-2 flex flex-col gap-2">
          {PAYMENT_METHODS.map((method) => (
            <label
              key={method.outcome}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-input p-3 transition-colors has-checked:border-chilli"
            >
              <input
                type="radio"
                name="payment-method"
                value={method.outcome}
                checked={selectedOutcome === method.outcome}
                onChange={() => setSelectedOutcome(method.outcome)}
                className="mt-1 accent-chilli"
              />
              <span>
                <span className="block text-body text-charcoal">{method.label}</span>
                <span className="block text-small text-charcoal/60">{method.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div aria-live="assertive">
        {paymentError && (
          <p role="alert" className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-small text-destructive">
            {paymentError}
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={() => goToStep(2)} disabled={isProcessing}>
          Back to Delivery
        </Button>
        <Button type="button" onClick={handlePay} disabled={isProcessing}>
          {isProcessing ? "Processing…" : "Pay now"}
        </Button>
      </div>
    </div>
  );
}
