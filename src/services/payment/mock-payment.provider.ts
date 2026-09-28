import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { PaymentProviderTimeoutError, PaymentWebhookPayloadError, PaymentWebhookSignatureError } from "@/services/payment.errors";
import { mockWebhookPayloadSchema } from "@/validation/payment.schema";
import type {
  PaymentConfirmation,
  PaymentIntentResponse,
  PaymentProvider,
  RefundResult,
  WebhookEvent,
} from "@/services/payment/payment-provider.interface";

/**
 * Simulates a gateway for local dev, tests, and demos — no external
 * network, no card data. The confirm `input.outcome` selector drives
 * success / decline / timeout, mirroring the sync and error paths a
 * real hosted-checkout adapter would surface. `handleWebhook`/`refund`
 * mirror the async-callback and refund shape a real adapter would need,
 * so checkout/order code never has to change when one is plugged in.
 */

/** Header the mock's webhook route reads its signature from. */
export const MOCK_WEBHOOK_SIGNATURE_HEADER = "x-mock-signature";

/**
 * Signs a raw webhook body the same way `MockPaymentProvider.handleWebhook`
 * verifies one — HMAC-SHA256 over the exact bytes, using AUTH_SECRET.
 * Reuses AUTH_SECRET rather than provisioning a separate mock-only secret
 * (same reasoning as src/lib/cart-token.ts). Exported for tests and any
 * dev-only tooling that simulates the provider's async callback.
 */
export function signMockWebhookPayload(rawBody: string): string {
  return createHmac("sha256", requireSecret()).update(rawBody).digest("hex");
}

function requireSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return secret;
}

export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";

  // The mock needs nothing from the request — a real adapter would send
  // amount/currency to its gateway here.
  async createIntent(): Promise<PaymentIntentResponse> {
    return { providerReference: `mock_${randomUUID()}` };
  }

  async confirmPayment(_providerReference: string, input: Record<string, unknown>): Promise<PaymentConfirmation> {
    switch (input.outcome) {
      case "success":
        return { status: "Succeeded" };
      case "decline":
        return { status: "Failed", failureReason: "Payment was declined (mock)." };
      case "timeout":
        throw new PaymentProviderTimeoutError();
      default:
        return { status: "Failed", failureReason: `Unknown mock outcome "${String(input.outcome)}".` };
    }
  }

  /**
   * Verifies the HMAC signature over the raw body first — content is
   * never parsed or trusted ahead of that check, matching how a real
   * gateway's webhook verification works.
   */
  async handleWebhook(rawBody: string, signature: string | null): Promise<WebhookEvent> {
    if (!signature || !this.verifySignature(rawBody, signature)) {
      throw new PaymentWebhookSignatureError();
    }

    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      throw new PaymentWebhookPayloadError("The webhook payload is not valid JSON.");
    }

    const parsed = mockWebhookPayloadSchema.safeParse(json);
    if (!parsed.success) throw new PaymentWebhookPayloadError();

    const { providerReference, outcome } = parsed.data;
    return outcome === "success"
      ? { providerReference, status: "Succeeded" }
      : { providerReference, status: "Failed", failureReason: "Payment was declined (mock webhook)." };
  }

  private verifySignature(rawBody: string, signature: string): boolean {
    const expected = Buffer.from(signMockWebhookPayload(rawBody), "hex");
    const actual = Buffer.from(signature, "hex");
    // Mismatched lengths would throw inside timingSafeEqual — treat that
    // as "invalid" rather than a request failure.
    if (expected.length !== actual.length) return false;
    return timingSafeEqual(expected, actual);
  }

  /**
   * A real adapter would call the gateway's refund API here and could
   * fail (already refunded upstream, capture window closed, etc.) — the
   * mock always succeeds since there is no external system to fail.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- a real adapter sends providerReference/amount to its gateway; the mock needs neither.
  async refund(providerReference: string, amount?: number): Promise<RefundResult> {
    return { status: "Refunded", providerRefundReference: `mock_refund_${randomUUID()}` };
  }
}
