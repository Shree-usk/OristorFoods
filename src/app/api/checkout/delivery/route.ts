import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { readCartCookie } from "@/lib/api/cart-cookie";
import { checkoutErrorResponse } from "@/lib/api/checkout-responses";
import { validationErrorResponse } from "@/lib/api/responses";
import { resolveDeliveryForCart } from "@/services/checkout.service";
import { checkoutDeliverySchema } from "@/validation/checkout.schema";

/**
 * Step 2: resolve the delivery zone and charge for the caller's live
 * cart. Non-"ok" statuses are returned as 200s with the resolution —
 * they are expected outcomes the UI renders (fail-safe messaging), not
 * request errors.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = checkoutDeliverySchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;
    const guestCookieValue = readCartCookie(request);

    const resolution = await resolveDeliveryForCart(userId, guestCookieValue, parsed.data.city);
    return NextResponse.json(resolution);
  } catch (error) {
    return checkoutErrorResponse(error);
  }
}
