// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { PaymentNotFoundError, PaymentProviderTimeoutError, PaymentProviderUnconfiguredError } from "@/services/payment.errors";
import { confirmPayment, createPaymentIntent } from "@/services/payment.service";

afterEach(async () => {
  await prisma.payment.deleteMany({ where: { providerReference: { startsWith: "mock_" } } });
  delete process.env.PAYMENT_PROVIDER;
});

describe("createPaymentIntent", () => {
  it("persists a Pending payment row for the server-computed amount", async () => {
    const intent = await createPaymentIntent(1234.5, "LKR");
    expect(intent.providerReference).toMatch(/^mock_/);

    const row = await prisma.payment.findUnique({ where: { providerReference: intent.providerReference } });
    expect(row).not.toBeNull();
    expect(row?.status).toBe("Pending");
    expect(row?.provider).toBe("mock");
    expect(row?.amount.toFixed(2)).toBe("1234.50");
  });

  it("rejects an unsupported PAYMENT_PROVIDER at the selection point", async () => {
    process.env.PAYMENT_PROVIDER = "stripe";
    await expect(createPaymentIntent(100, "LKR")).rejects.toBeInstanceOf(PaymentProviderUnconfiguredError);
  });
});

describe("confirmPayment", () => {
  it("marks the payment Succeeded on a mock success", async () => {
    const intent = await createPaymentIntent(500, "LKR");
    const result = await confirmPayment(intent.providerReference, { outcome: "success" });
    expect(result).toEqual({ status: "Succeeded", failureReason: null });

    const row = await prisma.payment.findUnique({ where: { providerReference: intent.providerReference } });
    expect(row?.status).toBe("Succeeded");
  });

  it("marks the payment Failed with a reason on a mock decline", async () => {
    const intent = await createPaymentIntent(500, "LKR");
    const result = await confirmPayment(intent.providerReference, { outcome: "decline" });
    expect(result.status).toBe("Failed");
    expect(result.failureReason).toMatch(/declined/i);

    const row = await prisma.payment.findUnique({ where: { providerReference: intent.providerReference } });
    expect(row?.status).toBe("Failed");
  });

  it("throws on a mock timeout and leaves the payment Pending (retryable)", async () => {
    const intent = await createPaymentIntent(500, "LKR");
    await expect(confirmPayment(intent.providerReference, { outcome: "timeout" })).rejects.toBeInstanceOf(PaymentProviderTimeoutError);

    const row = await prisma.payment.findUnique({ where: { providerReference: intent.providerReference } });
    expect(row?.status).toBe("Pending");
  });

  it("is idempotent for an already-Succeeded payment", async () => {
    const intent = await createPaymentIntent(500, "LKR");
    await confirmPayment(intent.providerReference, { outcome: "success" });
    const replay = await confirmPayment(intent.providerReference, { outcome: "decline" });
    expect(replay).toEqual({ status: "Succeeded", failureReason: null });
  });

  it("does not resurrect a Failed payment", async () => {
    const intent = await createPaymentIntent(500, "LKR");
    await confirmPayment(intent.providerReference, { outcome: "decline" });
    const retry = await confirmPayment(intent.providerReference, { outcome: "success" });
    expect(retry.status).toBe("Failed");
  });

  it("throws PaymentNotFoundError for an unknown reference", async () => {
    await expect(confirmPayment("mock_does-not-exist", { outcome: "success" })).rejects.toBeInstanceOf(PaymentNotFoundError);
  });
});
