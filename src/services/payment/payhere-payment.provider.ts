import { randomUUID } from "node:crypto";

import { PaymentRefundNotImplementedError, PaymentSyncConfirmNotSupportedError, PaymentWebhookPayloadError, PaymentWebhookSignatureError } from "@/services/payment.errors";
import { formatPayHereAmount, generateCheckoutHash, parseNotifyBody, verifyNotifySignature } from "@/services/payment/payhere-signature";
import type {
  PaymentConfirmation,
  PaymentIntentRequest,
  PaymentIntentResponse,
  PaymentProvider,
  RefundResult,
  WebhookEvent,
} from "@/services/payment/payment-provider.interface";

/**
 * PayHere Checkout API adapter (prep only — `PAYMENT_PROVIDER` stays
 * `"mock"` everywhere until a separate, explicit go-live decision; see
 * docs/PAYHERE_GO_LIVE_CHECKLIST.md). Uses PayHere's onsite JS SDK
 * (`payhere.js` + `startPayment()`) rather than the classic full-page
 * redirect Checkout API, so the existing client-side checkout wizard's
 * state survives — see docs/architecture-decisions.md's 2026-11-20 entry.
 *
 * Confirmation is ALWAYS asynchronous via `notify_url` — `handleWebhook`
 * is the only way a payment ever becomes Succeeded/Failed for this
 * provider. `confirmPayment` exists only to satisfy the interface and
 * always throws; the storefront never calls it for PayHere (it polls
 * `/api/payments/status` instead — see payhere-checkout-button.tsx).
 *
 * `handleWebhook` only ever accepts a TERMINAL PayHere `status_code` (2
 * Succeeded, -1/-2 Failed). `status_code` 0 (still processing) is a
 * genuine no-op that the two-outcome `WebhookEvent` contract can't
 * represent, and -3 (chargeback) has no home in the current
 * `PaymentStatus` enum (documented gap) — the notify route (Stage 3)
 * must filter both out before ever calling in here; this method throws
 * loudly rather than silently misreporting either as Succeeded/Failed.
 */
function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export class PayHereProvider implements PaymentProvider {
  readonly name = "payhere";

  async createIntent(request: PaymentIntentRequest): Promise<PaymentIntentResponse> {
    const merchantId = requiredEnv("PAYHERE_MERCHANT_ID");
    const merchantSecret = requiredEnv("PAYHERE_MERCHANT_SECRET");
    // No real Order exists yet at this point (checkout.service.ts::placeOrder
    // requires an already-Succeeded Payment before creating one) — this
    // opaque reference IS PayHere's order_id, exactly like the mock
    // provider's own providerReference. See architecture-decisions.md.
    const providerReference = `payhere_${randomUUID()}`;

    const hash = generateCheckoutHash({
      merchantId,
      orderId: providerReference,
      amount: request.amount,
      currency: request.currency,
      merchantSecret,
    });

    return {
      providerReference,
      clientPayload: {
        merchant_id: merchantId,
        order_id: providerReference,
        amount: formatPayHereAmount(request.amount),
        currency: request.currency,
        hash,
        return_url: requiredEnv("PAYHERE_RETURN_URL"),
        cancel_url: requiredEnv("PAYHERE_CANCEL_URL"),
        notify_url: requiredEnv("PAYHERE_NOTIFY_URL"),
      },
    };
  }

  async confirmPayment(): Promise<PaymentConfirmation> {
    throw new PaymentSyncConfirmNotSupportedError(this.name);
  }

  async handleWebhook(rawBody: string, signature: string | null): Promise<WebhookEvent> {
    const merchantSecret = requiredEnv("PAYHERE_MERCHANT_SECRET");
    const payload = parseNotifyBody(rawBody);
    if (!payload) throw new PaymentWebhookPayloadError("PayHere notify payload is missing required fields.");
    if (!signature || !verifyNotifySignature(payload, merchantSecret, signature)) {
      throw new PaymentWebhookSignatureError();
    }

    if (payload.statusCode === "2") return { providerReference: payload.orderId, status: "Succeeded" };
    if (payload.statusCode === "-1" || payload.statusCode === "-2") {
      return { providerReference: payload.orderId, status: "Failed", failureReason: payload.statusMessage ?? `PayHere declined with status_code ${payload.statusCode}.` };
    }
    throw new PaymentWebhookPayloadError(
      `Unsupported PayHere status_code "${payload.statusCode}" reached handleWebhook — only terminal codes (2, -1, -2) may; the notify route must filter 0 (pending) and -3 (chargeback) before calling in.`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- a real refund call needs both; not implemented yet (see error message).
  async refund(providerReference: string, amount?: number): Promise<RefundResult> {
    throw new PaymentRefundNotImplementedError(this.name);
  }
}
