import { NextResponse, type NextRequest } from "next/server";

import { setReferralCookie } from "@/lib/api/referral-cookie";
import { signReferralToken } from "@/lib/referral-token";

/**
 * Referral-link attribution (STORY-031). Runs on every entry page, not
 * just the homepage — a referral link can land anywhere. A `?ref=<code>`
 * query param signs and sets the attribution cookie (last-touch: a later
 * `?ref=` visit overwrites an earlier one); a plain visit with no param
 * leaves any existing cookie untouched. Whether the code actually
 * resolves to a real, active customer is checked later, at registration
 * (in a Node.js route) — this proxy never touches the DB, so an
 * unknown/expired code just becomes an unknown/expired code at that
 * point, never a request failure here.
 *
 * Named/placed per Next.js 16's `proxy.ts` convention (renamed from
 * `middleware.ts` in v16.0.0 — the old file/export name is deprecated).
 * The signing helper (src/lib/referral-token.ts) deliberately uses the
 * Web Crypto API rather than node:crypto so it works correctly whether
 * Proxy runs on the Node.js runtime (this version's default) or Edge —
 * not coupled to a default that has already changed once.
 */
export async function proxy(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("ref");
  if (!code) return NextResponse.next();

  const response = NextResponse.next();
  const token = await signReferralToken(code);
  setReferralCookie(response, token);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api/|favicon.ico|images/|downloads/).*)"],
};
