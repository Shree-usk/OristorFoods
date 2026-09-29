export type AuthErrorCode = "email_in_use" | "invalid_reset_token" | "reset_token_expired";

export class AuthServiceError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AuthServiceError";
  }
}

export class EmailInUseError extends AuthServiceError {
  constructor() {
    super("email_in_use", "An account with this email already exists.");
  }
}

export class InvalidResetTokenError extends AuthServiceError {
  constructor() {
    super("invalid_reset_token", "This password reset link is invalid.");
  }
}

export class ResetTokenExpiredError extends AuthServiceError {
  constructor() {
    super("reset_token_expired", "This password reset link has expired. Please request a new one.");
  }
}
