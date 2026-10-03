export type SystemSettingsErrorCode = "payment_method_key_conflict" | "feature_flag_key_conflict";

export class SystemSettingsError extends Error {
  constructor(
    public readonly code: SystemSettingsErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SystemSettingsError";
  }
}

export class PaymentMethodKeyConflictError extends SystemSettingsError {
  constructor() {
    super("payment_method_key_conflict", "A payment method with this key already exists.");
  }
}

export class FeatureFlagKeyConflictError extends SystemSettingsError {
  constructor() {
    super("feature_flag_key_conflict", "A feature flag with this key already exists.");
  }
}
