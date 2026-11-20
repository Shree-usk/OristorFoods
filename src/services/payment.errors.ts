export type PaymentErrorCode =
  | "not_found"
  | "provider_timeout"
  | "provider_unconfigured"
  | "webhook_invalid_signature"
  | "webhook_invalid_payload"
  | "webhook_amount_mismatch"
  | "sync_confirm_not_supported"
  | "refund_not_allowed"
  | "refund_amount_invalid"
  | "refund_not_implemented";

export class PaymentServiceError extends Error {
  constructor(
    public readonly code: PaymentErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PaymentServiceError";
  }
}

export class PaymentNotFoundError extends PaymentServiceError {
  constructor() {
    super("not_found", "Payment not found.");
  }
}

export class PaymentProviderTimeoutError extends PaymentServiceError {
  constructor() {
    super("provider_timeout", "The payment provider did not respond. Please try again.");
  }
}

export class PaymentProviderUnconfiguredError extends PaymentServiceError {
  constructor(configured: string | undefined) {
    super("provider_unconfigured", `Unsupported PAYMENT_PROVIDER "${configured ?? "(unset)"}" — no provider is registered under that name.`);
  }
}

export class PaymentWebhookSignatureError extends PaymentServiceError {
  constructor() {
    super("webhook_invalid_signature", "The webhook signature is missing or could not be verified.");
  }
}

export class PaymentWebhookPayloadError extends PaymentServiceError {
  constructor(message = "The webhook payload is missing required fields.") {
    super("webhook_invalid_payload", message);
  }
}

export class PaymentRefundNotAllowedError extends PaymentServiceError {
  constructor(public readonly currentStatus: string) {
    super("refund_not_allowed", `Only a Succeeded payment can be refunded (current status: ${currentStatus}).`);
  }
}

export class PaymentRefundAmountInvalidError extends PaymentServiceError {
  constructor() {
    super("refund_amount_invalid", "The refund amount cannot exceed the original payment amount.");
  }
}

/** A provider's own notify callback disagrees with the amount/currency we created the intent for — never trust the gateway's echoed amount blindly. */
export class PaymentWebhookAmountMismatchError extends PaymentServiceError {
  constructor() {
    super("webhook_amount_mismatch", "The webhook's reported amount or currency does not match the original payment.");
  }
}

/** PayHere (and some other gateways) confirm only via an async notify callback — there is no synchronous confirm to call. */
export class PaymentSyncConfirmNotSupportedError extends PaymentServiceError {
  constructor(providerName: string) {
    super("sync_confirm_not_supported", `"${providerName}" confirms payments only via its async webhook — there is no synchronous confirm step.`);
  }
}

/** PayHere's Refund API needs a separate OAuth app-credential pair the brief never named and no real account exists to test against yet — see docs/PAYHERE_GO_LIVE_CHECKLIST.md. */
export class PaymentRefundNotImplementedError extends PaymentServiceError {
  constructor(providerName: string) {
    super("refund_not_implemented", `"${providerName}" refunds are not implemented yet — requires a real merchant account to build and verify against.`);
  }
}
