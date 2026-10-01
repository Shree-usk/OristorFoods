/**
 * STORY-071. The minimal admin-customer capability this story ships
 * (setting a customer's pricing group) — the full console (STORY-048)
 * will likely grow a richer error set; this stays deliberately small.
 */
export type CustomerAdminErrorCode = "customer_not_found";

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
