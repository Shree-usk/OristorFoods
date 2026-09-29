/** Typed errors thrown by notification.service.ts. Consumed by the preferences route. */
export type NotificationErrorCode = "not_authenticated" | "provider_unconfigured";

export class NotificationServiceError extends Error {
  constructor(
    public readonly code: NotificationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "NotificationServiceError";
  }
}

export class NotificationNotAuthenticatedError extends NotificationServiceError {
  constructor() {
    super("not_authenticated", "Sign in to manage your notification preferences.");
  }
}

/**
 * Thrown only for an unrecognized non-"mock" SMS_PROVIDER/WHATSAPP_PROVIDER
 * value — mirrors PaymentProviderUnconfiguredError exactly. Email never
 * throws this: it always resolves to a real SMTP-or-Ethereal adapter.
 */
export class NotificationProviderUnconfiguredError extends NotificationServiceError {
  constructor(public readonly configured: string) {
    super("provider_unconfigured", `No notification provider is configured for "${configured}".`);
  }
}
