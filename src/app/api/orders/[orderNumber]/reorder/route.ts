import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { checkoutErrorResponse } from "@/lib/api/checkout-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { reorderPastOrder } from "@/services/customer-order-history.service";

/**
 * STORY-036. Session-only — reachable only from `/account/orders`, no
 * guest-cart path. Adds every still-in-stock item from the past order to
 * the customer's cart in one call; out-of-stock/no-longer-available items
 * are reported back, never silently dropped without explanation.
 */
export async function POST(request: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return unauthorizedResponse();

  try {
    const result = await reorderPastOrder(userId, orderNumber);
    return NextResponse.json(result);
  } catch (error) {
    return checkoutErrorResponse(error);
  }
}
