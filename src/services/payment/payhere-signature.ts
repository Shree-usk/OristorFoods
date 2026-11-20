import { createHash, timingSafeEqual } from "node:crypto";

/**
 * PayHere's own documented Checkout API hash/signature algorithm (MD5,
 * uppercased) — not a locally-chosen primitive. MD5 here is the gateway's
 * mandated scheme, unrelated to how this codebase signs its own mock
 * webhook (HMAC-SHA256, see mock-payment.provider.ts) — a real adapter
 * follows whatever its gateway actually requires, never substitutes a
 * "stronger" algorithm the gateway wouldn't recognize.
 *
 * NOTE: implemented from PayHere's publicly documented Checkout API
 * formula, not verified against a real PayHere sandbox transaction (no
 * credentials exist yet — see docs/PAYHERE_GO_LIVE_CHECKLIST.md). Treat
 * this as "structurally correct per the documented spec" until confirmed
 * against a real sandbox payment.
 */

function md5Upper(value: string): string {
  return createHash("md5").update(value).digest("hex").toUpperCase();
}

/** PayHere requires exactly 2 decimal places, '.' separator, no thousands separator. */
export function formatPayHereAmount(amount: number): string {
  return amount.toFixed(2);
}

export interface PayHereCheckoutHashInput {
  merchantId: string;
  orderId: string;
  amount: number;
  currency: string;
  merchantSecret: string;
}

/**
 * The `hash` field sent to PayHere's checkout (`payhere.startPayment()`):
 * MD5(merchant_id + order_id + amount + currency + MD5(merchant_secret).upper()).upper()
 */
export function generateCheckoutHash({ merchantId, orderId, amount, currency, merchantSecret }: PayHereCheckoutHashInput): string {
  const secretDigest = md5Upper(merchantSecret);
  return md5Upper(`${merchantId}${orderId}${formatPayHereAmount(amount)}${currency}${secretDigest}`);
}

export interface PayHereNotifyFields {
  merchantId: string;
  orderId: string;
  payhereAmount: string;
  payhereCurrency: string;
  statusCode: string;
}

/** Every field the notify route needs — the signed fields plus the two it isn't signed over but still needs: the signature itself and the human-readable decline reason. */
export interface PayHereNotifyPayload extends PayHereNotifyFields {
  statusMessage: string | null;
  md5sig: string | null;
}

/**
 * Parses PayHere's `notify_url` POST body (`application/x-www-form-urlencoded`).
 * Shared by the notify route (which needs the full payload to filter
 * non-terminal status codes and cross-check amount/currency before ever
 * calling into the PaymentProvider abstraction) and PayHereProvider.handleWebhook
 * itself, so the two never parse the same raw body two different ways.
 * Returns null if any field the signature formula needs is missing —
 * never partially trusts a malformed payload.
 */
export function parseNotifyBody(rawBody: string): PayHereNotifyPayload | null {
  const params = new URLSearchParams(rawBody);
  const merchantId = params.get("merchant_id");
  const orderId = params.get("order_id");
  const payhereAmount = params.get("payhere_amount");
  const payhereCurrency = params.get("payhere_currency");
  const statusCode = params.get("status_code");
  if (!merchantId || !orderId || !payhereAmount || !payhereCurrency || !statusCode) return null;

  return { merchantId, orderId, payhereAmount, payhereCurrency, statusCode, statusMessage: params.get("status_message"), md5sig: params.get("md5sig") };
}

/**
 * The `md5sig` PayHere's notify_url callback sends:
 * MD5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + MD5(merchant_secret).upper()).upper()
 * Same formula shape as the checkout hash, with status_code in place of
 * the plain amount/currency pairing's role — computed independently so a
 * future format change to one side doesn't silently affect the other.
 */
export function computeNotifySignature(fields: PayHereNotifyFields, merchantSecret: string): string {
  const secretDigest = md5Upper(merchantSecret);
  return md5Upper(`${fields.merchantId}${fields.orderId}${fields.payhereAmount}${fields.payhereCurrency}${fields.statusCode}${secretDigest}`);
}

/**
 * Constant-time comparison against the signature PayHere actually sent.
 * Case-insensitive (PayHere's own hashes are uppercase, but don't fail a
 * byte-for-byte-correct signature over a casing difference).
 */
export function verifyNotifySignature(fields: PayHereNotifyFields, merchantSecret: string, providedSignature: string): boolean {
  const expected = Buffer.from(computeNotifySignature(fields, merchantSecret), "utf-8");
  const provided = Buffer.from(providedSignature.toUpperCase(), "utf-8");
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}
