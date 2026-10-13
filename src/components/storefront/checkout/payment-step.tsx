"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/api-error";
import { confirmPayment, createPaymentIntent, fetchCheckoutBankAccounts, fetchEligiblePaymentMethods } from "@/lib/api/checkout-client";
import { useCheckoutStore } from "@/lib/stores/checkout-store";
import type { PaymentMethod } from "@/types/checkout";

/**
 * Story 4 (Payment Restriction). Until the real gateway decision
 * (blueprint Section 10), Card is simulated via the mock provider's
 * success/decline outcomes — exercising the same confirm/decline path a
 * real hosted checkout will use. Bank Transfer and Cash on Delivery have
 * no gateway to call at all: both write a Pending Payment row and let the
 * customer continue straight to Review — see
 * payment.service.ts::createManualPaymentIntent and checkout.service.ts's
 * own comments for why neither is ever marked paid here.
 */
const MOCK_OUTCOMES = [
  { outcome: "success" as const, label: "Mock payment — Success", description: "Simulates an approved payment (dev/test only)." },
  { outcome: "decline" as const, label: "Mock payment — Decline", description: "Simulates a declined payment (dev/test only)." },
];

export function PaymentStep() {
  const { address, fulfilmentMethod, paymentMethod, setPaymentMethod, intent, setIntent, markPaymentConfirmed, goToStep } = useCheckoutStore();
  const isPickup = fulfilmentMethod === "Pickup";
  const [selectedOutcome, setSelectedOutcome] = useState<"success" | "decline">("success");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const { data: eligibleMethods, isLoading: isLoadingMethods } = useQuery({
    queryKey: ["checkout-payment-methods"],
    queryFn: fetchEligiblePaymentMethods,
  });

  const { data: bankAccounts } = useQuery({
    queryKey: ["checkout-bank-accounts"],
    queryFn: fetchCheckoutBankAccounts,
    enabled: paymentMethod === "BankTransfer",
  });

  async function handleSelectMethod(method: PaymentMethod) {
    if (!isPickup && !address) return;
    setPaymentError(null);
    setPaymentMethod(method);
    setIsProcessing(true);
    try {
      // A fresh intent per selection: a declined Card intent's Payment row
      // stays Failed and can't be resurrected (payment.service.ts), so
      // switching methods (or retrying) always starts clean at the
      // current server-computed amount. Pickup has no city to resolve a
      // delivery charge from — the server charges 0 for it either way.
      const freshIntent = await createPaymentIntent(isPickup ? null : address!.city, method, fulfilmentMethod ?? "Delivery");
      setIntent(freshIntent);
    } catch (error) {
      setPaymentError(error instanceof ApiError ? error.message : "Could not start this payment method. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  }

  async function handlePayCard() {
    if (!intent) return;
    setIsProcessing(true);
    setPaymentError(null);
    try {
      const result = await confirmPayment(intent.providerReference, selectedOutcome);
      if (result.status === "Succeeded") {
        markPaymentConfirmed();
        goToStep(5);
      } else {
        setPaymentError(result.failureReason ?? "Your payment was declined. Please try another method.");
      }
    } catch (error) {
      setPaymentError(error instanceof ApiError ? error.message : "The payment could not be processed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  }

  function handleContinueManualMethod() {
    // BankTransfer/CashOnDelivery: nothing to confirm here — the Payment
    // row stays Pending through order placement (see
    // checkout.service.ts::placeOrder's method-aware status gate).
    // markPaymentConfirmed only advances the wizard's own local UI state.
    markPaymentConfirmed();
    goToStep(5);
  }

  return (
    <div>
      <h2 className="text-h3 font-heading text-charcoal">Payment</h2>
      {intent && (
        <p className="mt-2 text-small text-charcoal/70">
          Amount to pay: <span className="font-number font-semibold text-charcoal">LKR {intent.amount.toFixed(2)}</span>
        </p>
      )}

      {isLoadingMethods ? (
        <p className="mt-6 text-small text-charcoal/70">Loading payment methods…</p>
      ) : !eligibleMethods || eligibleMethods.length === 0 ? (
        <p role="alert" className="mt-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-small text-destructive">
          No payment methods are currently available. Please contact us to complete your order.
        </p>
      ) : (
        <fieldset className="mt-6">
          <legend className="text-small font-semibold text-charcoal">Choose a payment method</legend>
          <div className="mt-2 flex flex-col gap-2">
            {eligibleMethods.map((entry) => (
              <label
                key={entry.method}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-input p-3 transition-colors has-checked:border-chilli"
              >
                <input
                  type="radio"
                  name="payment-method"
                  value={entry.method}
                  checked={paymentMethod === entry.method}
                  onChange={() => handleSelectMethod(entry.method)}
                  disabled={isProcessing}
                  className="mt-1 accent-chilli"
                />
                <span className="block text-body text-charcoal">{entry.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {paymentMethod && intent && paymentMethod === "Card" && (
        <fieldset className="mt-6">
          <legend className="text-small font-semibold text-charcoal">Simulated card outcome</legend>
          <div className="mt-2 flex flex-col gap-2">
            {MOCK_OUTCOMES.map((outcome) => (
              <label
                key={outcome.outcome}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-input p-3 transition-colors has-checked:border-chilli"
              >
                <input
                  type="radio"
                  name="mock-outcome"
                  value={outcome.outcome}
                  checked={selectedOutcome === outcome.outcome}
                  onChange={() => setSelectedOutcome(outcome.outcome)}
                  className="mt-1 accent-chilli"
                />
                <span>
                  <span className="block text-body text-charcoal">{outcome.label}</span>
                  <span className="block text-small text-charcoal/70">{outcome.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {paymentMethod && intent && paymentMethod === "BankTransfer" && (
        <div className="mt-6 rounded-lg border border-input bg-cream p-4 text-small text-charcoal">
          <p>
            Please transfer <span className="font-number font-semibold">LKR {intent.amount.toFixed(2)}</span> to one of our business
            bank accounts below, using <span className="font-number font-semibold">{intent.providerReference}</span> as the payment
            reference.
          </p>
          {bankAccounts && bankAccounts.length > 0 && (
            <ul className="mt-3 flex flex-col gap-3">
              {bankAccounts.map((account) => (
                <li key={account.accountNumber} className="rounded-lg border border-input bg-white p-3">
                  <p className="font-semibold">{account.bankName}</p>
                  <p>{account.accountName}</p>
                  <p className="font-number">
                    {account.accountNumber} ({account.currency})
                  </p>
                  {account.branch && <p className="text-charcoal/70">Branch: {account.branch}</p>}
                  {account.swiftCode && <p className="text-charcoal/70">SWIFT: {account.swiftCode}</p>}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-charcoal/70">
            Your order will be placed and reviewed by our team — we&apos;ll confirm it once we&apos;ve received your transfer.
          </p>
        </div>
      )}

      {paymentMethod && intent && paymentMethod === "CashOnDelivery" && (
        <div className="mt-6 rounded-lg border border-input bg-cream p-4 text-small text-charcoal">
          <p>
            You&apos;ll pay <span className="font-number font-semibold">LKR {intent.amount.toFixed(2)}</span> in cash when your order
            is delivered.
          </p>
        </div>
      )}

      <div aria-live="assertive">
        {paymentError && (
          <p role="alert" className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-small text-destructive">
            {paymentError}
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={() => goToStep(isPickup ? 1 : 3)} disabled={isProcessing}>
          {isPickup ? "Back" : "Back to Delivery"}
        </Button>
        {paymentMethod && intent && paymentMethod === "Card" && (
          <Button type="button" onClick={handlePayCard} disabled={isProcessing}>
            {isProcessing ? "Processing…" : "Pay now"}
          </Button>
        )}
        {paymentMethod && intent && paymentMethod !== "Card" && (
          <Button type="button" onClick={handleContinueManualMethod} disabled={isProcessing}>
            Continue to review
          </Button>
        )}
      </div>
    </div>
  );
}
