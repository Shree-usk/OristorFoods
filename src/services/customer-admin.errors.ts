/** STORY-071/048. The admin-customer console's error set. */
export type CustomerAdminErrorCode = "customer_not_found" | "already_suspended" | "not_suspended";

export class CustomerAdminServiceError extends Error {
  readonly code: CustomerAdminErrorCode;

  constructor(code: CustomerAdminErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = new.target.name;
  }
}

export class CustomerNotFoundError extends CustomerAdminServiceError {
  constructor() {
    super("customer_not_found", "Customer not found");
  }
}

export class AccountAlreadySuspendedError extends CustomerAdminServiceError {
  constructor() {
    super("already_suspended", "This customer is already suspended.");
  }
}

export class AccountNotSuspendedError extends CustomerAdminServiceError {
  constructor() {
    super("not_suspended", "This customer isn't currently suspended.");
  }
}
