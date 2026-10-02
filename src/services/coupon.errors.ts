/**
 * Typed errors thrown by coupon.service.ts / discount.service.ts.
 * Consumed by BOTH cart-responses.ts (apply/remove via /api/cart/coupon)
 * and checkout-responses.ts (placeOrder's final re-validation) — a
 * coupon error can surface from either route family.
 */
export type CouponErrorCode =
  | "not_found"
  | "not_yet_active"
  | "expired"
  | "inactive"
  | "usage_limit_exceeded"
  | "customer_limit_exceeded"
  | "min_order_value_not_met"
  | "scope_not_met"
  | "already_applied"
  | "code_taken";

export class CouponServiceError extends Error {
  constructor(
    public readonly code: CouponErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CouponServiceError";
  }
}

export class CouponNotFoundError extends CouponServiceError {
  constructor() {
    super("not_found", "We couldn't find that coupon code.");
  }
}

export class CouponNotYetActiveError extends CouponServiceError {
  constructor() {
    super("not_yet_active", "This coupon isn't active yet.");
  }
}

export class CouponExpiredError extends CouponServiceError {
  constructor() {
    super("expired", "This coupon has expired.");
  }
}

export class CouponInactiveError extends CouponServiceError {
  constructor() {
    super("inactive", "This coupon is no longer available.");
  }
}

export class CouponUsageLimitExceededError extends CouponServiceError {
  constructor() {
    super("usage_limit_exceeded", "This coupon has reached its usage limit.");
  }
}

export class CouponCustomerLimitExceededError extends CouponServiceError {
  constructor() {
    super("customer_limit_exceeded", "You've already used this coupon the maximum number of times.");
  }
}

export class CouponMinOrderValueNotMetError extends CouponServiceError {
  constructor(
    public readonly minOrderValue: number,
    public readonly shortfall: number,
  ) {
    super("min_order_value_not_met", `Add ${shortfall.toFixed(2)} more to your cart to use this coupon (minimum order LKR ${minOrderValue.toFixed(2)}).`);
  }
}

export class CouponScopeNotMetError extends CouponServiceError {
  constructor() {
    super("scope_not_met", "Your cart doesn't contain any items this coupon applies to.");
  }
}

export class CouponAlreadyAppliedError extends CouponServiceError {
  constructor() {
    super("already_applied", "This coupon is already applied to your cart.");
  }
}

/** STORY-050b. Admin-entered coupon code collides with an existing one. */
export class CouponCodeTakenError extends CouponServiceError {
  constructor() {
    super("code_taken", "That coupon code is already in use.");
  }
}

/** STORY-050b. Admin console lookup by id (as opposed to CouponNotFoundError's code-based, no-enumeration message used at checkout). */
export class CouponAdminNotFoundError extends CouponServiceError {
  constructor() {
    super("not_found", "That coupon could not be found.");
  }
}

export class PromotionNotFoundError extends CouponServiceError {
  constructor() {
    super("not_found", "That promotion could not be found.");
  }
}
