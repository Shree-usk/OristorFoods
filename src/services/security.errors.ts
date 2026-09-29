export type SecurityErrorCode = "incorrect_current_password";

export class SecurityServiceError extends Error {
  constructor(
    public readonly code: SecurityErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SecurityServiceError";
  }
}

export class IncorrectCurrentPasswordError extends SecurityServiceError {
  constructor() {
    super("incorrect_current_password", "Your current password is incorrect.");
  }
}
