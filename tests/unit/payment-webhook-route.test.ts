// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { POST as postWebhook } from "@/app/api/payments/webhook/route";
import { MOCK_WEBHOOK_SIGNATURE_HEADER, signMockWebhookPayload } from "@/services/payment/mock-payment.provider";
import { createPaymentIntent } from "@/services/payment.service";

afterEach(async () => {
  await prisma.payment.deleteMany({ where: { providerReference: { startsWith: "mock_" } } });
});

function webhookRequest(rawBody: string, signature?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  if (signature) headers.set(MOCK_WEBHOOK_SIGNATURE_HEADER, signature);
  return new Request("http://localhost/api/payments/webhook", { method: "POST", headers, body: rawBody });
}

describe("POST /api/payments/webhook", () => {
  it("confirms a Pending payment via a correctly signed async callback", async () => {
    const intent = await createPaymentIntent(500, "LKR");
    const rawBody = JSON.stringify({ providerReference: intent.providerReference, outcome: "success" });
    const signature = signMockWebhookPayload(rawBody);

    const response = await postWebhook(webhookRequest(rawBody, signature));
    const body = (await response.json()) as { status: string; failureReason: string | null };
    expect(response.status).toBe(200);
    expect(body.status).toBe("Succeeded");

    const row = await prisma.payment.findUnique({ where: { providerReference: intent.providerReference } });
    expect(row?.status).toBe("Succeeded");
  });

  it("marks the payment Failed on a signed decline callback", async () => {
    const intent = await createPaymentIntent(500, "LKR");
    const rawBody = JSON.stringify({ providerReference: intent.providerReference, outcome: "decline" });
    const signature = signMockWebhookPayload(rawBody);

    const response = await postWebhook(webhookRequest(rawBody, signature));
    const body = (await response.json()) as { status: string; failureReason: string | null };
    expect(response.status).toBe(200);
    expect(body.status).toBe("Failed");
    expect(body.failureReason).toMatch(/declined/i);
  });

  it("rejects a webhook with a missing signature and leaves the payment untouched", async () => {
    const intent = await createPaymentIntent(500, "LKR");
    const rawBody = JSON.stringify({ providerReference: intent.providerReference, outcome: "success" });

    const response = await postWebhook(webhookRequest(rawBody));
    expect(response.status).toBe(401);

    const row = await prisma.payment.findUnique({ where: { providerReference: intent.providerReference } });
    expect(row?.status).toBe("Pending");
  });

  it("rejects a webhook with a signature computed over a different body", async () => {
    const intent = await createPaymentIntent(500, "LKR");
    const rawBody = JSON.stringify({ providerReference: intent.providerReference, outcome: "success" });
    const signatureForOtherBody = signMockWebhookPayload(JSON.stringify({ providerReference: "someone-else", outcome: "success" }));

    const response = await postWebhook(webhookRequest(rawBody, signatureForOtherBody));
    expect(response.status).toBe(401);

    const row = await prisma.payment.findUnique({ where: { providerReference: intent.providerReference } });
    expect(row?.status).toBe("Pending");
  });

  it("rejects a validly signed but malformed payload", async () => {
    const rawBody = JSON.stringify({ providerReference: "" });
    const signature = signMockWebhookPayload(rawBody);

    const response = await postWebhook(webhookRequest(rawBody, signature));
    expect(response.status).toBe(400);
  });

  it("is idempotent for a webhook replay of an already-Succeeded payment", async () => {
    const intent = await createPaymentIntent(500, "LKR");
    const rawBody = JSON.stringify({ providerReference: intent.providerReference, outcome: "success" });
    const signature = signMockWebhookPayload(rawBody);

    await postWebhook(webhookRequest(rawBody, signature));
    const replay = await postWebhook(webhookRequest(rawBody, signature));
    const body = (await replay.json()) as { status: string };
    expect(replay.status).toBe(200);
    expect(body.status).toBe("Succeeded");
  });
});
