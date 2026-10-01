import { NextResponse } from "next/server";

import { PermissionDeniedError } from "@/services/permission.errors";
import { OrderServiceError, type OrderErrorCode } from "@/services/order.errors";
import { PaymentServiceError, type PaymentErrorCode } from "@/services/payment.errors";
import { serverErrorResponse } from "@/lib/api/responses";

const orderStatusByCode: Record<OrderErrorCode, number> = {
  insufficient_stock: 409,
  order_number_exhausted: 503,
  not_found: 404,
  forbidden: 403,
  illegal_transition: 409,
  concurrent_transition: 409,
  cancellation_not_allowed: 409,
  return_not_allowed: 409,
  invalid_return_quantity: 400,
  refund_amount_exceeds_remaining: 400,
  no_payment_on_order: 409,
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

/** Every /api/admin/orders/* route handler's catch block goes through this. */
export function orderAdminErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof OrderServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: orderStatusByCode[error.code] });
  }
  if (error instanceof PaymentServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: paymentStatusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
