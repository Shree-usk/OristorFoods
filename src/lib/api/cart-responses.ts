import { NextResponse } from "next/server";

import { CartServiceError, type CartErrorCode } from "@/services/cart.errors";
import { StockExceededError } from "@/services/cart.errors";
import { CouponMinOrderValueNotMetError, CouponServiceError, type CouponErrorCode } from "@/services/coupon.errors";
import { RewardsInsufficientBalanceError, RewardsExceedsPerOrderCapError, RewardsServiceError, type RewardsErrorCode } from "@/services/rewards.errors";

const statusByCode: Record<CartErrorCode, number> = {
  not_found: 404,
  forbidden: 403,
  stock_exceeded: 409,
  unavailable: 409,
};

const couponStatusByCode: Record<CouponErrorCode, number> = {
  not_found: 404,
  not_yet_active: 409,
  expired: 409,
  inactive: 409,
  usage_limit_exceeded: 409,
  customer_limit_exceeded: 409,
  min_order_value_not_met: 409,
  scope_not_met: 409,
  already_applied: 409,
};

const rewardsStatusByCode: Record<RewardsErrorCode, number> = {
  not_authenticated: 401,
  insufficient_balance: 409,
  exceeds_per_order_cap: 409,
  redemption_unavailable: 409,
  invalid_amount: 400,
};

export function cartErrorResponse(error: unknown) {
  if (error instanceof StockExceededError) {
    return NextResponse.json({ error: error.message, availableQuantity: error.availableQuantity }, { status: 409 });
  }
  if (error instanceof CouponMinOrderValueNotMetError) {
    return NextResponse.json(
      { error: error.message, code: error.code, minOrderValue: error.minOrderValue, shortfall: error.shortfall },
      { status: couponStatusByCode[error.code] },
    );
  }
  if (error instanceof CouponServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: couponStatusByCode[error.code] });
  }
  if (error instanceof RewardsInsufficientBalanceError) {
    return NextResponse.json(
      { error: error.message, code: error.code, requested: error.requested, available: error.available },
      { status: rewardsStatusByCode[error.code] },
    );
  }
  if (error instanceof RewardsExceedsPerOrderCapError) {
    return NextResponse.json(
      { error: error.message, code: error.code, requested: error.requested, cap: error.cap },
      { status: rewardsStatusByCode[error.code] },
    );
  }
  if (error instanceof RewardsServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: rewardsStatusByCode[error.code] });
  }
  if (error instanceof CartServiceError) {
    return NextResponse.json({ error: error.message }, { status: statusByCode[error.code] });
  }
  throw error;
}
