import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { readCartCookie } from "@/lib/api/cart-cookie";
import { checkoutErrorResponse } from "@/lib/api/checkout-responses";
import { listEligiblePaymentMethods } from "@/services/checkout.service";

/**
 * Story 4 (Payment Restriction). The Payment step's own read — the
 * methods eligible for the caller's CURRENT cart, already narrowed to the
 * restricted set server-side when the cart contains custom packaging, so
 * the client never re-implements that rule.
 */
export async function GET(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;
    const guestCookieValue = readCartCookie(request);

    const methods = await listEligiblePaymentMethods(userId, guestCookieValue);
    return NextResponse.json(methods);
  } catch (error) {
    return checkoutErrorResponse(error);
  }
}
