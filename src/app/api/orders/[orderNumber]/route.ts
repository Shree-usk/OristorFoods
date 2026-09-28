import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { readCartCookie } from "@/lib/api/cart-cookie";
import { checkoutErrorResponse } from "@/lib/api/checkout-responses";
import { getConfirmation } from "@/services/checkout.service";

/**
 * Order detail (STORY-028), authorized by session user or the guest-cart
 * cookie token snapshotted onto the order — a stranger's request 404s
 * rather than confirming the order number exists. Reuses
 * checkout.service.ts's getConfirmation (same ownership-checked
 * lookup/mapping the confirmation page already renders), now extended
 * with statusHistory/erpSyncStatus/cancellation fields.
 */
export async function GET(request: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;

  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;
    const guestCookieValue = readCartCookie(request);

    const order = await getConfirmation(orderNumber, userId, guestCookieValue);
    return NextResponse.json(order);
  } catch (error) {
    return checkoutErrorResponse(error);
  }
}
