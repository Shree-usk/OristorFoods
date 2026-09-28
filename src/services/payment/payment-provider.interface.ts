/**
 * Provider-agnostic payment contract (STORY-026). The concrete payment
 * gateway is an OPEN BUSINESS DECISION (docs/blueprint.md Section 10) —
 * the mock provider is the only implementation by design, not a gap. Any
 * future concrete adapter (Stripe, PayHere, WebXPay, ...) implements this
 * same interface; no other module needs to change when one lands.
 *
 * No implementation may ever accept, persist, or log raw card/credential
 * data — a real adapter must use the gateway's hosted/tokenized flow.
 */

export interface PaymentIntentRequest {
  amount: number;
  currency: string;
}

export interface PaymentIntentResponse {
  providerReference: string;
}

export interface PaymentConfirmation {
  status: "Succeeded" | "Failed";
  failureReason?: string;
}

export interface WebhookEvent {
  providerReference: string;
  status: "Succeeded" | "Failed";
  failureReason?: string;
}

export interface RefundResult {
  status: "Refunded";
  providerRefundReference: string;
}

export interface PaymentProvider {
  readonly name: string;
  createIntent(request: PaymentIntentRequest): Promise<PaymentIntentResponse>;
  /**
   * Synchronous confirmation. `input` is provider-specific (the mock
   * reads an `outcome` selector; a real gateway would take its own
   * confirmation token). A transport-level failure (e.g. gateway
   * timeout) is thrown, not returned — a decline is a normal result.
   */
  confirmPayment(providerReference: string, input: Record<string, unknown>): Promise<PaymentConfirmation>;
  /**
   * Verifies and parses an async provider callback from the RAW request
   * body (never a pre-parsed object — signature verification must run
   * over the exact bytes the provider signed, before that content is
   * trusted). Throws on a missing/invalid signature or a malformed body;
   * a webhook is only ever applied after both checks pass.
   */
  handleWebhook(rawBody: string, signature: string | null): Promise<WebhookEvent>;
  /** Full or partial refund of a Succeeded payment. */
  refund(providerReference: string, amount?: number): Promise<RefundResult>;
}
