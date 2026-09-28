/**
 * Provider-agnostic payment contract (STORY-026). The concrete payment
 * gateway is an OPEN BUSINESS DECISION (docs/blueprint.md Section 10) —
 * the mock provider is the only implementation by design, not a gap.
 * STORY-026 proper extends this contract with handleWebhook()/refund();
 * this checkout slice needs only the synchronous intent → confirm path.
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
}
