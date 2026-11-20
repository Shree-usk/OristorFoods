import { NextResponse } from "next/server";

import { checkoutErrorResponse } from "@/lib/api/checkout-responses";
import { getPaymentByReference, handlePaymentWebhook } from "@/services/payment.service";
import { PaymentNotFoundError, PaymentWebhookAmountMismatchError, PaymentWebhookPayloadError, PaymentWebhookSignatureError } from "@/services/payment.errors";
import { parseNotifyBody, verifyNotifySignature } from "@/services/payment/payhere-signature";

/**
 * PayHere's own `notify_url` callback — a route of its own, not the
 * mock's `/api/payments/webhook` (each gateway registers its own URL
 * with its own payload shape/signing scheme; see
 * docs/architecture-decisions.md). The body is read as raw text and
 * PayHere's `md5sig` form field (not a header) is verified over those
 * exact bytes before anything here is trusted — see
 * payhere-signature.ts.
 *
 * Two checks happen HERE, before ever calling into the shared
 * PaymentProvider abstraction, because neither fits that generic
 * two-outcome contract:
 * 1. `status_code` 0 (still processing) and -3 (chargeback — not yet
 *    supported, documented gap) are genuine no-ops — acknowledged with
 *    200 so PayHere doesn't retry, but no state change.
 * 2. The amount/currency PayHere reports is cross-checked against the
 *    Payment row we created the intent for — never trusted blindly, per
 *    the brief's own explicit requirement — even though tampering either
 *    would already break the signature in practice.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const payload = parseNotifyBody(rawBody);
  if (!payload) return checkoutErrorResponse(new PaymentWebhookPayloadError("PayHere notify payload is missing required fields."));

  const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;
  if (!merchantSecret || !payload.md5sig || !verifyNotifySignature(payload, merchantSecret, payload.md5sig)) {
    return checkoutErrorResponse(new PaymentWebhookSignatureError());
  }

  if (payload.statusCode !== "2" && payload.statusCode !== "-1" && payload.statusCode !== "-2") {
    return NextResponse.json({ received: true, applied: false });
  }

  const payment = await getPaymentByReference(payload.orderId);
  if (!payment) return checkoutErrorResponse(new PaymentNotFoundError());
  if (payment.amount.toFixed(2) !== payload.payhereAmount || payment.currency !== payload.payhereCurrency) {
    return checkoutErrorResponse(new PaymentWebhookAmountMismatchError());
  }

  try {
    const result = await handlePaymentWebhook(rawBody, payload.md5sig);
    return NextResponse.json({ received: true, applied: true, ...result });
  } catch (error) {
    return checkoutErrorResponse(error);
  }
}
