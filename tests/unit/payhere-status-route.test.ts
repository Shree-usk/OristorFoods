// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { GET as getStatus } from "@/app/api/payments/status/route";
import { confirmPayment, createPaymentIntent } from "@/services/payment.service";

afterEach(async () => {
  await prisma.payment.deleteMany({ where: { providerReference: { startsWith: "mock_" } } });
});

function statusRequest(providerReference: string) {
  return new Request(`http://localhost/api/payments/status?providerReference=${encodeURIComponent(providerReference)}`);
}

/**
 * This route exists so the storefront can ask "what does the database
 * think happened" after a provider's own onsite callback fires — it is
 * provider-agnostic by construction (reads the Payment row directly), so
 * exercising it against the mock provider's own payments is sufficient;
 * it needs no PayHere-specific setup.
 */
describe("GET /api/payments/status", () => {
  it("reports Pending for a freshly created intent", async () => {
    const intent = await createPaymentIntent(500, "LKR");
    const response = await getStatus(statusRequest(intent.providerReference));
    const body = (await response.json()) as { status: string; failureReason: string | null };
    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "Pending", failureReason: null });
  });

  it("reports Succeeded once confirmed", async () => {
    const intent = await createPaymentIntent(500, "LKR");
    await confirmPayment(intent.providerReference, { outcome: "success" });

    const response = await getStatus(statusRequest(intent.providerReference));
    const body = (await response.json()) as { status: string };
    expect(body.status).toBe("Succeeded");
  });

  it("reports Failed with the reason once declined", async () => {
    const intent = await createPaymentIntent(500, "LKR");
    await confirmPayment(intent.providerReference, { outcome: "decline" });

    const response = await getStatus(statusRequest(intent.providerReference));
    const body = (await response.json()) as { status: string; failureReason: string | null };
    expect(body.status).toBe("Failed");
    expect(body.failureReason).toMatch(/declined/i);
  });

  it("never leaks amount, currency, or provider details", async () => {
    const intent = await createPaymentIntent(500, "LKR");
    const response = await getStatus(statusRequest(intent.providerReference));
    const body = (await response.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["failureReason", "status"]);
  });

  it("404s for an unknown reference", async () => {
    const response = await getStatus(statusRequest("mock_does-not-exist"));
    expect(response.status).toBe(404);
  });

  it("400s for a missing providerReference", async () => {
    const response = await getStatus(new Request("http://localhost/api/payments/status"));
    expect(response.status).toBe(400);
  });
});
