import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PaymentRefundNotImplementedError, PaymentSyncConfirmNotSupportedError, PaymentWebhookPayloadError, PaymentWebhookSignatureError } from "@/services/payment.errors";
import { PayHereProvider } from "@/services/payment/payhere-payment.provider";
import { computeNotifySignature, generateCheckoutHash } from "@/services/payment/payhere-signature";

const ENV_KEYS = ["PAYHERE_MERCHANT_ID", "PAYHERE_MERCHANT_SECRET", "PAYHERE_RETURN_URL", "PAYHERE_CANCEL_URL", "PAYHERE_NOTIFY_URL", "PAYHERE_ENV"] as const;
const MERCHANT_ID = "1211149";
const MERCHANT_SECRET = "test-secret-value";

function setTestEnv() {
  process.env.PAYHERE_MERCHANT_ID = MERCHANT_ID;
  process.env.PAYHERE_MERCHANT_SECRET = MERCHANT_SECRET;
  process.env.PAYHERE_RETURN_URL = "https://staging.oristor.com/checkout/payment/return";
  process.env.PAYHERE_CANCEL_URL = "https://staging.oristor.com/checkout/payment/cancel";
  process.env.PAYHERE_NOTIFY_URL = "https://staging.oristor.com/api/payments/payhere/notify";
}

beforeEach(setTestEnv);
afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

function notifyBody(fields: Record<string, string>): string {
  return new URLSearchParams(fields).toString();
}

describe("PayHereProvider.createIntent", () => {
  it("returns an opaque providerReference and a correctly hashed clientPayload", async () => {
    const provider = new PayHereProvider();
    const result = await provider.createIntent({ amount: 1000, currency: "LKR" });

    expect(result.providerReference).toMatch(/^payhere_/);
    expect(result.clientPayload).toMatchObject({
      merchant_id: MERCHANT_ID,
      order_id: result.providerReference,
      amount: "1000.00",
      currency: "LKR",
      return_url: process.env.PAYHERE_RETURN_URL,
      cancel_url: process.env.PAYHERE_CANCEL_URL,
      notify_url: process.env.PAYHERE_NOTIFY_URL,
    });

    const expectedHash = generateCheckoutHash({ merchantId: MERCHANT_ID, orderId: result.providerReference, amount: 1000, currency: "LKR", merchantSecret: MERCHANT_SECRET });
    expect(result.clientPayload?.hash).toBe(expectedHash);
  });

  it("defaults the onsite SDK to sandbox mode when PAYHERE_ENV is unset", async () => {
    const provider = new PayHereProvider();
    const result = await provider.createIntent({ amount: 1000, currency: "LKR" });
    expect(result.clientPayload?.sandbox).toBe(true);
  });

  it("switches the onsite SDK to live mode only when PAYHERE_ENV is exactly \"live\"", async () => {
    process.env.PAYHERE_ENV = "live";
    const provider = new PayHereProvider();
    const result = await provider.createIntent({ amount: 1000, currency: "LKR" });
    expect(result.clientPayload?.sandbox).toBe(false);
  });

  it("throws when a required PayHere env var is missing", async () => {
    delete process.env.PAYHERE_MERCHANT_ID;
    const provider = new PayHereProvider();
    await expect(provider.createIntent({ amount: 1000, currency: "LKR" })).rejects.toThrow("PAYHERE_MERCHANT_ID");
  });
});

describe("PayHereProvider.confirmPayment", () => {
  it("always throws — PayHere confirms only via the async notify webhook", async () => {
    const provider = new PayHereProvider();
    await expect(provider.confirmPayment()).rejects.toBeInstanceOf(PaymentSyncConfirmNotSupportedError);
  });
});

describe("PayHereProvider.handleWebhook", () => {
  const fields = { merchant_id: MERCHANT_ID, order_id: "payhere_abc123", payhere_amount: "1000.00", payhere_currency: "LKR" };

  it("resolves Succeeded for a correctly signed status_code 2", async () => {
    const statusCode = "2";
    const signature = computeNotifySignature(
      { merchantId: fields.merchant_id, orderId: fields.order_id, payhereAmount: fields.payhere_amount, payhereCurrency: fields.payhere_currency, statusCode },
      MERCHANT_SECRET,
    );
    const provider = new PayHereProvider();
    const event = await provider.handleWebhook(notifyBody({ ...fields, status_code: statusCode }), signature);
    expect(event).toEqual({ providerReference: fields.order_id, status: "Succeeded" });
  });

  it.each(["-1", "-2"])("resolves Failed with the gateway's status_message for status_code %s", async (statusCode) => {
    const signature = computeNotifySignature(
      { merchantId: fields.merchant_id, orderId: fields.order_id, payhereAmount: fields.payhere_amount, payhereCurrency: fields.payhere_currency, statusCode },
      MERCHANT_SECRET,
    );
    const provider = new PayHereProvider();
    const event = await provider.handleWebhook(notifyBody({ ...fields, status_code: statusCode, status_message: "Card declined by issuer" }), signature);
    expect(event).toEqual({ providerReference: fields.order_id, status: "Failed", failureReason: "Card declined by issuer" });
  });

  it("rejects a missing signature", async () => {
    const provider = new PayHereProvider();
    await expect(provider.handleWebhook(notifyBody({ ...fields, status_code: "2" }), null)).rejects.toBeInstanceOf(PaymentWebhookSignatureError);
  });

  it("rejects a tampered amount even with an otherwise-valid-looking signature", async () => {
    const statusCode = "2";
    const signature = computeNotifySignature(
      { merchantId: fields.merchant_id, orderId: fields.order_id, payhereAmount: fields.payhere_amount, payhereCurrency: fields.payhere_currency, statusCode },
      MERCHANT_SECRET,
    );
    const provider = new PayHereProvider();
    await expect(provider.handleWebhook(notifyBody({ ...fields, payhere_amount: "1.00", status_code: statusCode }), signature)).rejects.toBeInstanceOf(PaymentWebhookSignatureError);
  });

  it("rejects a payload missing required fields", async () => {
    const provider = new PayHereProvider();
    await expect(provider.handleWebhook(notifyBody({ order_id: fields.order_id, status_code: "2" }), "anything")).rejects.toBeInstanceOf(PaymentWebhookPayloadError);
  });

  it.each(["0", "-3"])("refuses to silently reinterpret a non-terminal status_code %s — the notify route must filter it first", async (statusCode) => {
    const signature = computeNotifySignature(
      { merchantId: fields.merchant_id, orderId: fields.order_id, payhereAmount: fields.payhere_amount, payhereCurrency: fields.payhere_currency, statusCode },
      MERCHANT_SECRET,
    );
    const provider = new PayHereProvider();
    await expect(provider.handleWebhook(notifyBody({ ...fields, status_code: statusCode }), signature)).rejects.toBeInstanceOf(PaymentWebhookPayloadError);
  });
});

describe("PayHereProvider.refund", () => {
  it("throws PaymentRefundNotImplementedError — no real account exists yet to build/verify against", async () => {
    const provider = new PayHereProvider();
    await expect(provider.refund("payhere_abc123")).rejects.toBeInstanceOf(PaymentRefundNotImplementedError);
  });
});
