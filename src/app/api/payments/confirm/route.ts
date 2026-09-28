import { NextResponse } from "next/server";

import { checkoutErrorResponse } from "@/lib/api/checkout-responses";
import { validationErrorResponse } from "@/lib/api/responses";
import { confirmPayment } from "@/services/payment.service";
import { confirmPaymentSchema } from "@/validation/payment.schema";

/**
 * Synchronous payment confirmation (STORY-026's route, mock-only slice).
 * A decline is a normal 200 result the UI renders on the Payment step;
 * a provider timeout surfaces as 504 (retryable). The async webhook
 * path (/api/payments/webhook) lands with STORY-026 proper.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = confirmPaymentSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const result = await confirmPayment(parsed.data.providerReference, { outcome: parsed.data.outcome });
    return NextResponse.json(result);
  } catch (error) {
    return checkoutErrorResponse(error);
  }
}
