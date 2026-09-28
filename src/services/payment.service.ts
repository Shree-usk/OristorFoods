import * as paymentRepository from "@/repositories/payment.repository";
import {
  PaymentNotFoundError,
  PaymentProviderUnconfiguredError,
  PaymentRefundAmountInvalidError,
  PaymentRefundNotAllowedError,
} from "@/services/payment.errors";
import { MockPaymentProvider } from "@/services/payment/mock-payment.provider";
import type { PaymentProvider, RefundResult } from "@/services/payment/payment-provider.interface";
import type { PaymentIntentResult } from "@/types/checkout";

/**
 * Provider-agnostic payment orchestration (STORY-026): create/confirm an
 * intent, apply an async webhook callback, and refund — all through the
 * PaymentProvider interface. getActiveProvider() below is the ONE place a
 * concrete provider may be imported. The concrete gateway is an open
 * business decision (blueprint Section 10, cross-referenced in
 * docs/architecture-decisions.md); "mock" is the only valid
 * PAYMENT_PROVIDER value until that decision is made — this is not a
 * technical gap, so don't "fix" it by guessing a provider.
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
 * Applies a Succeeded/Failed outcome to a payment already looked up by
 * the caller, shared by the synchronous confirm path and the async
 * webhook path so the idempotency rule lives in exactly one place:
 * an already-Succeeded payment stays Succeeded (a retried request must
 * never flip a completed payment) and a Failed payment stays Failed —
 * the customer creates a fresh intent instead of resurrecting it.
 */
async function applyOutcome(
  payment: { id: string; status: string },
  outcome: { status: "Succeeded" | "Failed"; failureReason?: string },
): Promise<ConfirmPaymentResult> {
  if (payment.status === "Succeeded") return { status: "Succeeded", failureReason: null };
  if (payment.status !== "Pending") return { status: "Failed", failureReason: "This payment can no longer be confirmed." };

  await paymentRepository.updatePaymentStatus(payment.id, outcome.status);
  return { status: outcome.status, failureReason: outcome.failureReason ?? null };
}

/** Confirms a pending payment via the synchronous provider path. */
export async function confirmPayment(providerReference: string, input: Record<string, unknown>): Promise<ConfirmPaymentResult> {
  const payment = await paymentRepository.findPaymentByReference(providerReference);
  if (!payment) throw new PaymentNotFoundError();
  if (payment.status !== "Pending") return applyOutcome(payment, { status: "Failed" });

  const provider = getActiveProvider();
  const confirmation = await provider.confirmPayment(providerReference, input);
  return applyOutcome(payment, confirmation);
}

/**
 * Applies an async provider callback (`/api/payments/webhook`). The
 * provider verifies the signature and parses its own payload shape
 * before this ever sees a `WebhookEvent` — proving checkout handles both
 * synchronous confirmation and asynchronous confirmation identically
 * from this point on, with no code difference at real-gateway-integration
 * time.
 */
export async function handlePaymentWebhook(rawBody: string, signature: string | null): Promise<ConfirmPaymentResult> {
  const provider = getActiveProvider();
  const event = await provider.handleWebhook(rawBody, signature);

  const payment = await paymentRepository.findPaymentByReference(event.providerReference);
  if (!payment) throw new PaymentNotFoundError();
  return applyOutcome(payment, event);
}

/**
 * Refunds a Succeeded payment (full, or partial via `amount`). Only the
 * mock implements this today — see MockPaymentProvider.refund — but the
 * contract is stable now so STORY-028's return flow and the future admin
 * refund action (STORY-047) have something to call.
 */
export async function refundPayment(paymentId: string, amount?: number): Promise<RefundResult> {
  const payment = await paymentRepository.findPaymentById(paymentId);
  if (!payment) throw new PaymentNotFoundError();
  if (payment.status !== "Succeeded") throw new PaymentRefundNotAllowedError(payment.status);
  if (amount !== undefined && amount > payment.amount.toNumber()) throw new PaymentRefundAmountInvalidError();

  const provider = getActiveProvider();
  const result = await provider.refund(payment.providerReference, amount);
  await paymentRepository.updatePaymentStatus(payment.id, "Refunded");
  return result;
}

export function getPaymentByReference(providerReference: string) {
  return paymentRepository.findPaymentByReference(providerReference);
}
