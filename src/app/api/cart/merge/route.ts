import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api/responses";
import { cartErrorResponse } from "@/lib/api/cart-responses";
import { readCartCookie } from "@/lib/api/cart-cookie";
import { CART_COOKIE_NAME, mergeGuestCartIntoUser } from "@/services/cart.service";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    const guestCookieValue = readCartCookie(request);
    await mergeGuestCartIntoUser(session.user.id, guestCookieValue);

    // The cookie is httpOnly, so only the server can clear it — this
    // response does that. mergeGuestCartIntoUser has already deleted the
    // guest Cart row itself (claimed atomically before merging, see its
    // own doc comment), so clearing the cookie here just stops the
    // browser from sending a now-meaningless token on future requests.
    const response = NextResponse.json({ ok: true });
    response.cookies.delete(CART_COOKIE_NAME);
    return response;
  } catch (error) {
    return cartErrorResponse(error);
  }
}
