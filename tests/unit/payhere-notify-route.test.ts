// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { POST as postNotify } from "@/app/api/payments/payhere/notify/route";
import { createPaymentIntent } from "@/services/payment.service";
import { computeNotifySignature } from "@/services/payment/payhere-signature";

const ENV_KEYS = ["PAYMENT_PROVIDER", "PAYHERE_MERCHANT_ID", "PAYHERE_MERCHANT_SECRET", "PAYHERE_RETURN_URL", "PAYHERE_CANCEL_URL", "PAYHERE_NOTIFY_URL"] as const;
const MERCHANT_ID = "1211149";
const MERCHANT_SECRET = "test-secret-value";

beforeEach(() => {
  process.env.PAYMENT_PROVIDER = "payhere";
  process.env.PAYHERE_MERCHANT_ID = MERCHANT_ID;
  process.env.PAYHERE_MERCHANT_SECRET = MERCHANT_SECRET;
  process.env.PAYHERE_RETURN_URL = "https://staging.oristor.com/checkout/payment/return";
  process.env.PAYHERE_CANCEL_URL = "https://staging.oristor.com/checkout/payment/cancel";
  process.env.PAYHERE_NOTIFY_URL = "https://staging.oristor.com/api/payments/payhere/notify";
});

afterEach(async () => {
  await prisma.payment.deleteMany({ where: { providerReference: { startsWith: "payhere_" } } });
  for (const key of ENV_KEYS) delete process.env[key];
});

function notifyRequest(fields: Record<string, string>) {
  return new Request("http://localhost/api/payments/payhere/notify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}

async function createRealIntent(amount = 1000) {
  const intent = await createPaymentIntent(amount, "LKR");
  return intent;
}

function signedFields(intent: { providerReference: string }, amount: string, statusCode: string, extra: Record<string, string> = {}) {
  const base = { merchant_id: MERCHANT_ID, order_id: intent.providerReference, payhere_amount: amount, payhere_currency: "LKR", status_code: statusCode };
  const md5sig = computeNotifySignature(
    { merchantId: base.merchant_id, orderId: base.order_id, payhereAmount: base.payhere_amount, payhereCurrency: base.payhere_currency, statusCode: base.status_code },
    MERCHANT_SECRET,
  );
  return { ...base, ...extra, md5sig };
}

describe("POST /api/payments/payhere/notify", () => {
  it("marks the payment Succeeded on a correctly signed status_code 2 matching the original amount", async () => {
    const intent = await createRealIntent(1000);
    const response = await postNotify(notifyRequest(signedFields(intent, "1000.00", "2")));
    expect(response.status).toBe(200);

    const row = await prisma.payment.findUnique({ where: { providerReference: intent.providerReference } });
    expect(row?.status).toBe("Succeeded");
  });

  it("marks the payment Failed with the gateway's status_message on status_code -2", async () => {
    const intent = await createRealIntent(1000);
    const response = await postNotify(notifyRequest(signedFields(intent, "1000.00", "-2", { status_message: "Card declined by issuer" })));
    expect(response.status).toBe(200);

    const row = await prisma.payment.findUnique({ where: { providerReference: intent.providerReference } });
    expect(row?.status).toBe("Failed");
    expect(row?.failureReason).toBe("Card declined by issuer");
  });

  it("acknowledges a correctly signed status_code 0 (pending) without changing anything", async () => {
    const intent = await createRealIntent(1000);
    const response = await postNotify(notifyRequest(signedFields(intent, "1000.00", "0")));
    const body = (await response.json()) as { applied: boolean };
    expect(response.status).toBe(200);
    expect(body.applied).toBe(false);

    const row = await prisma.payment.findUnique({ where: { providerReference: intent.providerReference } });
    expect(row?.status).toBe("Pending");
  });

  it("acknowledges a correctly signed status_code -3 (chargeback) without changing anything — documented gap", async () => {
    const intent = await createRealIntent(1000);
    await prisma.payment.update({ where: { providerReference: intent.providerReference }, data: { status: "Succeeded" } });

    const response = await postNotify(notifyRequest(signedFields(intent, "1000.00", "-3")));
    expect(response.status).toBe(200);

    const row = await prisma.payment.findUnique({ where: { providerReference: intent.providerReference } });
    expect(row?.status).toBe("Succeeded");
  });

  it("rejects a notify with a missing signature", async () => {
    const intent = await createRealIntent(1000);
    const fields = signedFields(intent, "1000.00", "2");
    const { md5sig, ...withoutSignature } = fields;
    void md5sig;

    const response = await postNotify(notifyRequest(withoutSignature));
    expect(response.status).toBe(401);

    const row = await prisma.payment.findUnique({ where: { providerReference: intent.providerReference } });
    expect(row?.status).toBe("Pending");
  });

  it("rejects a notify whose reported amount does not match the original payment, even if internally consistent", async () => {
    const intent = await createRealIntent(1000);
    // Signed over a tampered amount — this IS what a correctly-signed-but-wrong notification looks like.
    const response = await postNotify(notifyRequest(signedFields(intent, "1.00", "2")));
    expect(response.status).toBe(400);

    const row = await prisma.payment.findUnique({ where: { providerReference: intent.providerReference } });
    expect(row?.status).toBe("Pending");
  });

  it("rejects an unknown order_id", async () => {
    const md5sig = computeNotifySignature(
      { merchantId: MERCHANT_ID, orderId: "payhere_does-not-exist", payhereAmount: "1000.00", payhereCurrency: "LKR", statusCode: "2" },
      MERCHANT_SECRET,
    );
    const response = await postNotify(
      notifyRequest({ merchant_id: MERCHANT_ID, order_id: "payhere_does-not-exist", payhere_amount: "1000.00", payhere_currency: "LKR", status_code: "2", md5sig }),
    );
    expect(response.status).toBe(404);
  });

  it("rejects a malformed payload missing required fields", async () => {
    const response = await postNotify(notifyRequest({ order_id: "payhere_abc", status_code: "2" }));
    expect(response.status).toBe(400);
  });

  it("is idempotent for a duplicate notify of an already-Succeeded payment", async () => {
    const intent = await createRealIntent(1000);
    const request = () => notifyRequest(signedFields(intent, "1000.00", "2"));

    await postNotify(request());
    const replay = await postNotify(request());
    expect(replay.status).toBe(200);

    const row = await prisma.payment.findUnique({ where: { providerReference: intent.providerReference } });
    expect(row?.status).toBe("Succeeded");
  });
});
