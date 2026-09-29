/**
 * Typed errors thrown by rewards.service.ts. Consumed by both
 * cart-responses.ts (POST/DELETE /api/cart/points) and
 * checkout-responses.ts (placeOrder's final re-validation) — a rewards
 * error can surface from either route family, same as coupon errors.
 */
export type RewardsErrorCode =
  | "not_authenticated"
  | "insufficient_balance"
  | "exceeds_per_order_cap"
  | "redemption_unavailable"
  | "invalid_amount";

export class RewardsServiceError extends Error {
  constructor(
    public readonly code: RewardsErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RewardsServiceError";
  }
}

export class RewardsNotAuthenticatedError extends RewardsServiceError {
  constructor() {
    super("not_authenticated", "Sign in to redeem reward points.");
  }
}

export class RewardsInsufficientBalanceError extends RewardsServiceError {
  constructor(
    public readonly requested: number,
    public readonly available: number,
  ) {
    super("insufficient_balance", `You only have ${available} reward points available.`);
  }
}

export class RewardsExceedsPerOrderCapError extends RewardsServiceError {
  constructor(
    public readonly requested: number,
    public readonly cap: number,
  ) {
    super("exceeds_per_order_cap", `You can redeem at most ${cap} points per order.`);
  }
}

export class RewardsRedemptionUnavailableError extends RewardsServiceError {
  constructor() {
    super("redemption_unavailable", "Point redemption isn't available right now.");
  }
}

export class RewardsInvalidAmountError extends RewardsServiceError {
  constructor() {
    super("invalid_amount", "Enter a positive whole number of points.");
  }
}
