import type { NextResponse } from "next/server";

import { CART_COOKIE_NAME } from "@/services/cart.service";

export function readCartCookie(request: Request): string | undefined {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`${CART_COOKIE_NAME}=([^;]+)`));
  return match?.[1];
}

export function setCartCookie(response: NextResponse, cookieValue: string): void {
  response.cookies.set(CART_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
