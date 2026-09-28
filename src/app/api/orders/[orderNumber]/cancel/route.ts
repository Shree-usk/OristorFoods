import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { readCartCookie } from "@/lib/api/cart-cookie";
import { checkoutErrorResponse } from "@/lib/api/checkout-responses";
import { validationErrorResponse } from "@/lib/api/responses";
import { verifyCartCookieValue } from "@/lib/cart-token";
import { cancelOrder } from "@/services/order.service";
import { cancelOrderSchema } from "@/validation/order.schema";

/**
 * Customer-initiated cancellation (STORY-028), authorized identically to
 * the order-detail route. Only valid while the order's current status
 * still permits it (order.service.ts's transition table, same guard
 * transitionOrderStatus uses) — a stranger's request 404s, an ineligible
 * status 409s.
 */
export async function POST(request: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = cancelOrderSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;
    const guestCookieValue = readCartCookie(request);
    const guestToken = userId ? null : (verifyCartCookieValue(guestCookieValue ?? undefined) ?? null);

    const { order, refundOutcome } = await cancelOrder(orderNumber, userId, guestToken, parsed.data.reason);
    return NextResponse.json({ orderNumber: order.orderNumber, status: order.status, refundOutcome });
  } catch (error) {
    return checkoutErrorResponse(error);
  }
}
