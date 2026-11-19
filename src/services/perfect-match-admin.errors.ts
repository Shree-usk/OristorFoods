export type PerfectMatchAdminErrorCode =
  | "product_not_found"
  | "product_already_added"
  | "underlying_product_not_found"
  | "pairing_not_found"
  | "pairing_limit_exceeded";

export class PerfectMatchAdminError extends Error {
  constructor(
    public readonly code: PerfectMatchAdminErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PerfectMatchAdminError";
  }
}

export class PerfectMatchProductNotFoundError extends PerfectMatchAdminError {
  constructor() {
    super("product_not_found", "Perfect Match product entry not found.");
  }
}

/** The catalogue Product itself doesn't exist — distinct from PerfectMatchProductNotFoundError, which means the *link row* wasn't found. */
export class PerfectMatchUnderlyingProductNotFoundError extends PerfectMatchAdminError {
  constructor() {
    super("underlying_product_not_found", "That product doesn't exist.");
  }
}

/** Each existing Product may only be linked into the rail once (PerfectMatchProduct.productId is @unique) — add pairings to the existing entry instead of adding the same product twice. */
export class PerfectMatchProductAlreadyAddedError extends PerfectMatchAdminError {
  constructor() {
    super("product_already_added", "This product is already part of The Perfect Match.");
  }
}

export class PerfectMatchPairingNotFoundError extends PerfectMatchAdminError {
  constructor() {
    super("pairing_not_found", "Meal pairing not found.");
  }
}

/** The homepage experience shows exactly 4 pairings per product — enforced here, not as a DB constraint, same convention as every other "max N" business rule in this codebase. */
export class PerfectMatchPairingLimitExceededError extends PerfectMatchAdminError {
  constructor() {
    super("pairing_limit_exceeded", "A product can have at most 4 published meal pairings.");
  }
}
