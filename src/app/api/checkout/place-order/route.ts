import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { readCartCookie } from "@/lib/api/cart-cookie";
import { checkoutErrorResponse } from "@/lib/api/checkout-responses";
import { validationErrorResponse } from "@/lib/api/responses";
import { placeOrder } from "@/services/checkout.service";
import { placeOrderSchema } from "@/validation/checkout.schema";

/**
 * Step 4: final revalidation + atomic, idempotent order creation. All
 * amounts are recomputed server-side; the request carries no totals.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = placeOrderSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;
    const guestCookieValue = readCartCookie(request);

    const result = await placeOrder(userId, guestCookieValue, parsed.data);
    return NextResponse.json(result, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    return checkoutErrorResponse(error);
  }
}
