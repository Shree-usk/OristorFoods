import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { readCartCookie } from "@/lib/api/cart-cookie";
import { cartErrorResponse } from "@/lib/api/cart-responses";
import { removeGiftFromCart } from "@/services/gift-offer.service";

export async function DELETE(request: Request, { params }: { params: Promise<{ giftInstanceId: string }> }) {
  const { giftInstanceId } = await params;
  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;
    const guestCookieValue = readCartCookie(request);

    await removeGiftFromCart(userId, guestCookieValue, giftInstanceId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return cartErrorResponse(error);
  }
}
