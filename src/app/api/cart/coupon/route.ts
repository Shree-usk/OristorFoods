import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { cartErrorResponse } from "@/lib/api/cart-responses";
import { readCartCookie, setCartCookie } from "@/lib/api/cart-cookie";
import { validationErrorResponse } from "@/lib/api/responses";
import { applyCouponToCart, removeCouponFromCart } from "@/services/coupon.service";
import { applyCouponSchema } from "@/validation/coupon.schema";

export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = applyCouponSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;
    const guestCookieValue = readCartCookie(request);

    const { summary, newCookieValue } = await applyCouponToCart(userId, guestCookieValue, parsed.data.code);
    const response = NextResponse.json(summary);
    if (newCookieValue) setCartCookie(response, newCookieValue);
    return response;
  } catch (error) {
    return cartErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;
    const guestCookieValue = readCartCookie(request);

    const { summary, newCookieValue } = await removeCouponFromCart(userId, guestCookieValue);
    const response = NextResponse.json(summary);
    if (newCookieValue) setCartCookie(response, newCookieValue);
    return response;
  } catch (error) {
    return cartErrorResponse(error);
  }
}
