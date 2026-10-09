import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { INSTAGRAM_OAUTH_STATE_COOKIE } from "@/lib/instagram-oauth-state";
import { handleOAuthCallback } from "@/services/instagram.service";

function settingsRedirect(request: Request, params: Record<string, string>) {
  const url = new URL("/admin/settings", request.url);
  url.searchParams.set("tab", "integrations");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

/** Instagram redirects the admin's browser back here after they approve the connection on Instagram's own site — see oauth/start/route.ts. */
export async function GET(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/admin/login", request.url));

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(INSTAGRAM_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(INSTAGRAM_OAUTH_STATE_COOKIE);

  if (oauthError) return settingsRedirect(request, { instagram: "error", message: oauthError });
  if (!code || !state || !expectedState || state !== expectedState) {
    return settingsRedirect(request, { instagram: "error", message: "The connection request expired or was invalid — please try again." });
  }

  try {
    const { username } = await handleOAuthCallback(session.user.id, code);
    return settingsRedirect(request, { instagram: "connected", username });
  } catch (error) {
    return settingsRedirect(request, { instagram: "error", message: error instanceof Error ? error.message : "Connection failed." });
  }
}
