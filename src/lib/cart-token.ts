import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signs a new, high-entropy guest cart token with AUTH_SECRET (HMAC-SHA256)
 * — the first hand-set (non-NextAuth) cookie in this codebase. No new
 * secret to provision: AUTH_SECRET is already required by NextAuth.
 * `token` is the raw value stored as Cart.guestToken (the DB lookup key);
 * `cookieValue` (`token.signature`) is what actually goes in the cookie —
 * never store cookieValue itself as a lookup key, always verify first.
 */
export function signCartToken(): { token: string; cookieValue: string } {
  const token = randomBytes(24).toString("base64url");
  const signature = sign(token);
  return { token, cookieValue: `${token}.${signature}` };
}

/**
 * Verifies a cookie value read back from the request. Returns the raw
 * token (safe to use as a Cart.guestToken lookup key) if the signature is
 * valid, or null for anything else — missing, malformed, tampered token,
 * tampered signature, or a token that was never actually signed by this
 * server. Never throws: a bad cookie is always "start a new guest cart",
 * not a request failure.
 */
export function verifyCartCookieValue(cookieValue: string | undefined): string | null {
  if (!cookieValue) return null;
  const parts = cookieValue.split(".");
  if (parts.length !== 2) return null;
  const [token, signature] = parts;
  if (!token || !signature) return null;

  const expected = sign(token);
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(signature, "hex");
  if (expectedBuffer.length !== actualBuffer.length) return null;
  if (!timingSafeEqual(expectedBuffer, actualBuffer)) return null;

  return token;
}

function sign(token: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHmac("sha256", secret).update(token).digest("hex");
}
