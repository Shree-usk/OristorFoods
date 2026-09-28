import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { readCartCookie } from "@/lib/api/cart-cookie";
import { checkoutErrorResponse } from "@/lib/api/checkout-responses";
import { validationErrorResponse } from "@/lib/api/responses";
import { createIntentForCart } from "@/services/checkout.service";
import { checkoutPaymentIntentSchema } from "@/validation/checkout.schema";

/**
 * Step 3: create a payment intent. The amount is always computed
 * server-side from the live cart + freshly resolved delivery charge —
 * the request carries only the destination city.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = checkoutPaymentIntentSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;
    const guestCookieValue = readCartCookie(request);

    const intent = await createIntentForCart(userId, guestCookieValue, parsed.data.city);
    return NextResponse.json(intent);
  } catch (error) {
    return checkoutErrorResponse(error);
  }
}
