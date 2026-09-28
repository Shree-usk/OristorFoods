import { NextResponse } from "next/server";

import { checkoutErrorResponse } from "@/lib/api/checkout-responses";
import { handlePaymentWebhook } from "@/services/payment.service";
import { MOCK_WEBHOOK_SIGNATURE_HEADER } from "@/services/payment/mock-payment.provider";

/**
 * Async provider callback (STORY-026). The body is read as raw text, not
 * JSON — signature verification must run over the exact bytes the
 * provider signed, before that content is trusted or parsed. Proves the
 * checkout flow handles both sync (`/api/payments/confirm`) and async
 * confirmation without any other code changing.
 *
 * This route currently binds to the mock provider's callback scheme
 * (its own header name and HMAC signing — see mock-payment.provider.ts).
 * A real gateway adapter would register its OWN webhook URL with that
 * provider (each gateway's payload shape and signature scheme differ),
 * not reuse this one — see docs/architecture-decisions.md.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get(MOCK_WEBHOOK_SIGNATURE_HEADER);

  try {
    const result = await handlePaymentWebhook(rawBody, signature);
    return NextResponse.json(result);
  } catch (error) {
    return checkoutErrorResponse(error);
  }
}
