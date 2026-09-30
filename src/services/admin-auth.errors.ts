export type AdminAuthErrorCode = "account_locked";

export class AdminAuthServiceError extends Error {
  constructor(
    public readonly code: AdminAuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AdminAuthServiceError";
  }
}

/**
 * Deliberately distinguishable from a plain wrong-password rejection
 * (which returns null, no-enumeration, same as customer auth) — lockout
 * state isn't sensitive the way "does this email exist" is, and the AC
 * wants a locked-out admin clearly told so.
 */
export class AccountLockedError extends AdminAuthServiceError {
  constructor(public readonly lockedUntil: Date) {
    super("account_locked", `This account is locked until ${lockedUntil.toISOString()} after too many failed sign-in attempts.`);
  }
}
