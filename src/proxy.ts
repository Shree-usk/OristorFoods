import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { setReferralCookie } from "@/lib/api/referral-cookie";
import { signReferralToken } from "@/lib/referral-token";

/**
 * Referral-link attribution (STORY-031). Runs on every entry page, not
 * just the homepage — a referral link can land anywhere. A `?ref=<code>`
 * query param signs and sets the attribution cookie (last-touch: a later
 * `?ref=` visit overwrites an earlier one); a plain visit with no param
 * leaves any existing cookie untouched. Whether the code actually
 * resolves to a real, active customer is checked later, at registration
 * (in a Node.js route) — this proxy never touches the DB for THIS check,
 * so an unknown/expired code just becomes an unknown/expired code at that
 * point, never a request failure here.
 *
 * Named/placed per Next.js 16's `proxy.ts` convention (renamed from
 * `middleware.ts` in v16.0.0 — the old file/export name is deprecated).
 * The signing helper (src/lib/referral-token.ts) deliberately uses the
 * Web Crypto API rather than node:crypto so it works correctly whether
 * Proxy runs on the Node.js runtime (this version's default) or Edge —
 * not coupled to a default that has already changed once.
 *
 * STORY-033 adds the account-area guard below. Next 16 allows only one
 * proxy.ts per project, so both concerns live here. The guard is scoped
 * to `/account/*` (excluding the public auth pages and wishlist, which
 * STORY-013 deliberately supports for guests too) — auth()'s jwt callback
 * does read the DB (for the password-reset session-invalidation check),
 * but only for that subset of requests, never the broad referral matcher
 * below as a whole.
 */

const PUBLIC_ACCOUNT_PREFIXES = ["/account/login", "/account/register", "/account/forgot-password", "/account/reset-password", "/account/wishlist"];

function isPublicAccountPath(pathname: string): boolean {
  return PUBLIC_ACCOUNT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/account") && !isPublicAccountPath(pathname)) {
    const session = await auth();
    if (!session?.user?.id) {
      const loginUrl = new URL("/account/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname + search);
      return NextResponse.redirect(loginUrl);
    }
  }

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
