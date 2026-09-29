import type { NextResponse } from "next/server";

/** Mirrors cart-cookie.ts's shape. Set by src/middleware.ts, read at registration. */
export const REFERRAL_COOKIE_NAME = "oristor-referral-attribution";

export function readReferralCookie(request: Request): string | undefined {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`${REFERRAL_COOKIE_NAME}=([^;]+)`));
  return match?.[1];
}

/**
 * A fixed, generous ceiling (90 days) — middleware runs on the Edge
 * runtime and can't cheaply read the admin-configured attribution window
 * from the DB, so it can only ever set an upper bound. The real,
 * configurable window (ReferralSetting.attributionWindowDays) is enforced
 * separately at registration time against the signed `ts` in the payload.
 */
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

export function setReferralCookie(response: NextResponse, cookieValue: string): void {
  response.cookies.set(REFERRAL_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}
