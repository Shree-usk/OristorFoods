import { NextResponse } from "next/server";

import { CartServiceError, type CartErrorCode } from "@/services/cart.errors";
import { StockExceededError } from "@/services/cart.errors";

const statusByCode: Record<CartErrorCode, number> = {
  not_found: 404,
  forbidden: 403,
  stock_exceeded: 409,
  unavailable: 409,
};

export function cartErrorResponse(error: unknown) {
  if (error instanceof StockExceededError) {
    return NextResponse.json({ error: error.message, availableQuantity: error.availableQuantity }, { status: 409 });
  }
  if (error instanceof CartServiceError) {
    return NextResponse.json({ error: error.message }, { status: statusByCode[error.code] });
  }
  throw error;
}
