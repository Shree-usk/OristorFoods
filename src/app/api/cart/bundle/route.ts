import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { readCartCookie, setCartCookie } from "@/lib/api/cart-cookie";
import { cartErrorResponse } from "@/lib/api/cart-responses";
import { validationErrorResponse } from "@/lib/api/responses";
import { addBundleToCart } from "@/services/bundle.service";
import { addBundleToCartSchema } from "@/validation/cart.schema";

export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = addBundleToCartSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;
    const guestCookieValue = readCartCookie(request);

    const { newCookieValue } = await addBundleToCart(userId, guestCookieValue, parsed.data.bundleId, parsed.data.selections ?? null);

    const response = NextResponse.json({ ok: true });
    if (newCookieValue) setCartCookie(response, newCookieValue);
    return response;
  } catch (error) {
    return cartErrorResponse(error);
  }
}
