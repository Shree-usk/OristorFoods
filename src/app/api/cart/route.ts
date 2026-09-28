import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { readCartCookie, setCartCookie } from "@/lib/api/cart-cookie";
import { cartErrorResponse } from "@/lib/api/cart-responses";
import { getCart, resolveCartIdentity } from "@/services/cart.service";

export async function GET(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;
    const guestCookieValue = readCartCookie(request);

    // Resolving identity separately from getCart (which also resolves it
    // internally) is intentional here — this is the one route that must
    // set the guest cookie on a first visit, so it needs the
    // newCookieValue that getCart's own return type doesn't carry. Passing
    // the resolved newCookieValue (falling back to the original cookie)
    // into getCart is required — passing the original, still-absent
    // cookie a second time would make getCart's own resolveCartIdentity
    // call create a SECOND guest cart, orphaning the first.
    const { newCookieValue } = await resolveCartIdentity(userId, guestCookieValue);
    const summary = await getCart(userId, newCookieValue ?? guestCookieValue);

    const response = NextResponse.json(summary);
    if (newCookieValue) setCartCookie(response, newCookieValue);
    return response;
  } catch (error) {
    return cartErrorResponse(error);
  }
}
