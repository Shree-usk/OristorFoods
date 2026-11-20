import { NextResponse } from "next/server";

import { validationErrorResponse } from "@/lib/api/responses";
import { getPaymentByReference } from "@/services/payment.service";
import { paymentStatusQuerySchema } from "@/validation/payment.schema";

/**
 * Lets the storefront poll the DATABASE's own view of a payment's status
 * after a provider's onsite SDK reports completion client-side (e.g.
 * PayHere's `onCompleted` callback) — that callback is never treated as
 * proof of payment on its own; only this (ultimately webhook-driven)
 * status is. Returns only status/failureReason — never the amount,
 * currency, or any provider/credential detail.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = paymentStatusQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const payment = await getPaymentByReference(parsed.data.providerReference);
  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

  return NextResponse.json({ status: payment.status, failureReason: payment.failureReason });
}
