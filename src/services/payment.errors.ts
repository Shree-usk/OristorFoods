export type PaymentErrorCode = "not_found" | "provider_timeout" | "provider_unconfigured";

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
