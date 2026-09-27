import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api/responses";
import { cartErrorResponse } from "@/lib/api/cart-responses";
import { readCartCookie } from "@/lib/api/cart-cookie";
import { mergeGuestCartIntoUser } from "@/services/cart.service";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    const guestCookieValue = readCartCookie(request);
    await mergeGuestCartIntoUser(session.user.id, guestCookieValue);

    // The guest cookie is cleared client-side only after this response
    // succeeds (CartMergeSync, Task 9) — but clearing it here too means a
    // stale cookie from a different tab can't resurrect a Cart row this
    // request already deleted.
    const response = NextResponse.json({ ok: true });
    response.cookies.delete("oristor-cart-token");
    return response;
  } catch (error) {
    return cartErrorResponse(error);
  }
}
