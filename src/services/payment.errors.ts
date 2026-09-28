export type PaymentErrorCode =
  | "not_found"
  | "provider_timeout"
  | "provider_unconfigured"
  | "webhook_invalid_signature"
  | "webhook_invalid_payload"
  | "refund_not_allowed"
  | "refund_amount_invalid";

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
    super(
      "provider_unconfigured",
      `Unsupported PAYMENT_PROVIDER "${configured ?? "(unset)"}" — only "mock" exists until the gateway decision (blueprint Section 10) is made.`,
    );
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
