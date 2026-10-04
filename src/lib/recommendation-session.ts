import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

/**
 * STORY-060, reused by STORY-061's SearchQueryLog/rate limiting.
 * Anonymous-visitor correlation for soft telemetry — a lightweight,
 * unsigned cookie, deliberately NOT a reuse of cart-token.ts's signed
 * HMAC mechanism (that guards cart content integrity, a materially
 * higher-stakes concern than this; tampering here has no security or
 * data-integrity impact). Both consumers are the same kind of signal
 * (recommendation personalization, search query logging/rate-limit
 * keying) — one shared cookie, not a proliferating one-per-feature set.
 */
const COOKIE_NAME = "rec_sid";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Route Handlers only — Route Handlers can set cookies, Server Components cannot. Reads the existing session id or mints and stores a new one. */
export async function getOrCreateSessionId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(COOKIE_NAME)?.value;
  if (existing) return existing;

  const sessionId = randomUUID();
  cookieStore.set(COOKIE_NAME, sessionId, { httpOnly: true, sameSite: "lax", maxAge: MAX_AGE_SECONDS, path: "/" });
  return sessionId;
}

/** Server Components — read-only, since they cannot set cookies. Returns null if no session has been established yet (the visitor's first request, before any /api/recommendations/* call has run). */
export async function getSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}
