import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { adminAuth } from "@/lib/admin-auth";
import { setReferralCookie } from "@/lib/api/referral-cookie";
import { getActiveRedirectsCached } from "@/lib/redirect-cache";
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
 *
 * STORY-038 adds the admin-area guard the same way, using the fully
 * separate adminAuth() (src/lib/admin-auth.ts — its own session cookie,
 * its own secret). This is a UX-level redirect only — the real security
 * boundary for any specific action is permission.service.ts's
 * requirePermission(), called server-side in the Service layer; a signed-in
 * admin reaching a page here is not the same as being authorized to use it.
 *
 * STORY-051b adds admin-managed URL redirects, checked first (before the
 * account/admin guards above) via getActiveRedirectsCached() — a 10s-TTL
 * in-memory cache (src/lib/redirect-cache.ts), not a DB query on every
 * request. A cheap Map lookup against every incoming pathname. That TTL
 * is the *only* freshness mechanism here — redirect.service.ts's own
 * cache-invalidation calls run in a separate module bundle from this
 * middleware and never reach this file's copy of the cache (confirmed
 * empirically, see redirect-cache.ts's own comment); a newly created or
 * edited redirect can take up to 10s to actually resolve.
 */

const PUBLIC_ACCOUNT_PREFIXES = [
  "/account/login",
  "/account/register",
  "/account/forgot-password",
  "/account/reset-password",
  "/account/wishlist",
  // STORY-034: the email-change confirmation link may be opened on a
  // different, unauthenticated browser/device — same reasoning as
  // password reset. The API route it calls is unauthenticated-allowed too.
  "/account/profile/verify-email",
];

function isPublicAccountPath(pathname: string): boolean {
  return PUBLIC_ACCOUNT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

const PUBLIC_ADMIN_PREFIXES = ["/admin/login"];

function isPublicAdminPath(pathname: string): boolean {
  return PUBLIC_ADMIN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const redirects = await getActiveRedirectsCached();
  const redirect = redirects.get(pathname);
  if (redirect) return NextResponse.redirect(new URL(redirect.destinationPath, request.url), redirect.statusCode);

  if (pathname.startsWith("/account") && !isPublicAccountPath(pathname)) {
    const session = await auth();
    if (!session?.user?.id) {
      const loginUrl = new URL("/account/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname + search);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname.startsWith("/admin") && !isPublicAdminPath(pathname)) {
    const session = await adminAuth();
    if (!session?.user?.id) {
      const loginUrl = new URL("/admin/login", request.url);
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
