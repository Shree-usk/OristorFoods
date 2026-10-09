import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { instagramErrorResponse } from "@/lib/api/instagram-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { INSTAGRAM_OAUTH_STATE_COOKIE } from "@/lib/instagram-oauth-state";
import { getAuthorizeUrl } from "@/services/instagram.service";

/** The admin panel's "Connect with Instagram" button is a plain link to this route — a real browser navigation, not a fetch, so the OAuth redirect dance works the normal way. */
export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    const state = randomBytes(24).toString("hex");
    const authorizeUrl = await getAuthorizeUrl(session.user.id, state);

    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set(INSTAGRAM_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    });
    return response;
  } catch (error) {
    return instagramErrorResponse(error, "GET /api/admin/settings/integrations/instagram/oauth/start");
  }
}
