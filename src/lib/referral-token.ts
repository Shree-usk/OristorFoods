/**
 * Signs the referral-attribution cookie (STORY-031). Deliberately built on
 * the Web Crypto API (`crypto.subtle`), not `node:crypto` like
 * cart-token.ts — this is read/written from src/proxy.ts (Next.js 16's
 * renamed `middleware.ts`), which can run on the Node.js runtime or Edge
 * depending on config/version; Web Crypto works correctly under either,
 * so signing here isn't coupled to whichever one happens to be the
 * current default. Same HMAC-SHA256-over-AUTH_SECRET idea as
 * cart-token.ts. Unlike the guest-cart token (an opaque random value
 * looked up in the DB), this cookie carries meaningful data directly —
 * the referral code and the time it was set — so registration-time code
 * can enforce the admin-configured attribution window without a DB round
 * trip from inside the proxy.
 */

export interface ReferralAttributionPayload {
  code: string;
  ts: number;
}

async function hmacKey(): Promise<CryptoKey> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function textToBase64Url(text: string): string {
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToText(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return atob(padded + pad);
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
  return textToBase64Url(binary);
}

function base64UrlToBytes(value: string): Uint8Array {
  const binary = base64UrlToText(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Signs `{code, ts: Date.now()}` for the attribution cookie. */
export async function signReferralToken(code: string): Promise<string> {
  const payload: ReferralAttributionPayload = { code, ts: Date.now() };
  const payloadEncoded = textToBase64Url(JSON.stringify(payload));
  const key = await hmacKey();
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadEncoded));
  return `${payloadEncoded}.${bufferToBase64Url(signature)}`;
}

/**
 * Verifies a cookie value read back from a request. Returns the decoded
 * `{code, ts}` if the signature is valid, or null for anything else —
 * missing, malformed, tampered, or never actually signed by this server.
 * Never throws: a bad cookie always means "no attribution", never a
 * request failure.
 */
export async function verifyReferralToken(cookieValue: string | undefined): Promise<ReferralAttributionPayload | null> {
  if (!cookieValue) return null;
  const parts = cookieValue.split(".");
  if (parts.length !== 2) return null;
  const [payloadEncoded, signature] = parts;
  if (!payloadEncoded || !signature) return null;

  try {
    const key = await hmacKey();
    // @types/node's Uint8Array augmentation widens the generic ArrayBuffer
    // parameter to ArrayBufferLike, which lib.dom's BufferSource rejects —
    // both are safe here, this is purely a types conflict between the two.
    const signatureBytes = base64UrlToBytes(signature) as unknown as BufferSource;
    const valid = await crypto.subtle.verify("HMAC", key, signatureBytes, new TextEncoder().encode(payloadEncoded));
    if (!valid) return null;

    const parsed = JSON.parse(base64UrlToText(payloadEncoded)) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as ReferralAttributionPayload).code !== "string" ||
      typeof (parsed as ReferralAttributionPayload).ts !== "number"
    ) {
      return null;
    }
    return parsed as ReferralAttributionPayload;
  } catch {
    return null;
  }
}
