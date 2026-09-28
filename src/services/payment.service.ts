import * as paymentRepository from "@/repositories/payment.repository";
import { PaymentNotFoundError, PaymentProviderUnconfiguredError } from "@/services/payment.errors";
import { MockPaymentProvider } from "@/services/payment/mock-payment.provider";
import type { PaymentProvider } from "@/services/payment/payment-provider.interface";
import type { PaymentIntentResult } from "@/types/checkout";

/**
 * Provider-agnostic payment orchestration (STORY-026 thin slice: the
 * synchronous intent → confirm path only; webhooks and refunds land with
 * STORY-026 proper). Everything below depends only on the
 * PaymentProvider interface — this selection point is the ONE place a
 * concrete provider may be imported. The concrete gateway is an open
 * business decision (blueprint Section 10); "mock" is the only valid
 * PAYMENT_PROVIDER value until that decision is made.
 */
function getActiveProvider(): PaymentProvider {
  const configured = process.env.PAYMENT_PROVIDER ?? "mock";
  if (configured === "mock") return new MockPaymentProvider();
  throw new PaymentProviderUnconfiguredError(configured);
}

export async function createPaymentIntent(amount: number, currency: string): Promise<PaymentIntentResult> {
  const provider = getActiveProvider();
  const intent = await provider.createIntent({ amount, currency });
  await paymentRepository.createPayment(provider.name, intent.providerReference, amount.toFixed(2), currency);
  return { providerReference: intent.providerReference, amount, currency };
}

export interface ConfirmPaymentResult {
  status: "Succeeded" | "Failed";
  failureReason: string | null;
}

/**
 * Confirms a pending payment. Re-confirming an already-Succeeded payment
 * is an idempotent no-op (a retried request must not flip a completed
 * payment); a Failed payment stays failed — the customer creates a fresh
 * intent instead.
 */
export async function confirmPayment(providerReference: string, input: Record<string, unknown>): Promise<ConfirmPaymentResult> {
  const payment = await paymentRepository.findPaymentByReference(providerReference);
  if (!payment) throw new PaymentNotFoundError();

  if (payment.status === "Succeeded") return { status: "Succeeded", failureReason: null };
  if (payment.status !== "Pending") return { status: "Failed", failureReason: "This payment can no longer be confirmed." };

  const provider = getActiveProvider();
  const confirmation = await provider.confirmPayment(providerReference, input);
  await paymentRepository.updatePaymentStatus(payment.id, confirmation.status);
  return { status: confirmation.status, failureReason: confirmation.failureReason ?? null };
}

export function getPaymentByReference(providerReference: string) {
  return paymentRepository.findPaymentByReference(providerReference);
}
