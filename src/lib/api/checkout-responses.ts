import { NextResponse } from "next/server";

import { CartServiceError, StockExceededError } from "@/services/cart.errors";
import { CheckoutServiceError, DeliveryUnavailableError, type CheckoutErrorCode } from "@/services/checkout.errors";
import { OrderServiceError, type OrderErrorCode } from "@/services/order.errors";
import { PaymentServiceError, type PaymentErrorCode } from "@/services/payment.errors";

const checkoutStatusByCode: Record<CheckoutErrorCode, number> = {
  empty_cart: 409,
  cart_invalid: 409,
  delivery_unavailable: 422,
  payment_not_confirmed: 402,
  totals_changed: 409,
  guest_email_required: 400,
  address_not_found: 404,
};

const orderStatusByCode: Record<OrderErrorCode, number> = {
  insufficient_stock: 409,
  order_number_exhausted: 503,
  not_found: 404,
  forbidden: 403,
  illegal_transition: 409,
  concurrent_transition: 409,
  cancellation_not_allowed: 409,
};

const paymentStatusByCode: Record<PaymentErrorCode, number> = {
  not_found: 404,
  provider_timeout: 504,
  provider_unconfigured: 500,
  webhook_invalid_signature: 401,
  webhook_invalid_payload: 400,
  refund_not_allowed: 409,
  refund_amount_invalid: 400,
};

export function checkoutErrorResponse(error: unknown) {
  if (error instanceof DeliveryUnavailableError) {
    return NextResponse.json(
      { error: error.message, code: error.code, resolutionStatus: error.resolutionStatus },
      { status: checkoutStatusByCode[error.code] },
    );
  }
  if (error instanceof CheckoutServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: checkoutStatusByCode[error.code] });
  }
  if (error instanceof OrderServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: orderStatusByCode[error.code] });
  }
  if (error instanceof PaymentServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: paymentStatusByCode[error.code] });
  }
  if (error instanceof StockExceededError) {
    return NextResponse.json({ error: error.message, availableQuantity: error.availableQuantity }, { status: 409 });
  }
  if (error instanceof CartServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
  }
  throw error;
}
