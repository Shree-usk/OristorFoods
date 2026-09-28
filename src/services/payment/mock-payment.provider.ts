import { randomUUID } from "node:crypto";

import { PaymentProviderTimeoutError } from "@/services/payment.errors";
import type {
  PaymentConfirmation,
  PaymentIntentResponse,
  PaymentProvider,
} from "@/services/payment/payment-provider.interface";

/**
 * Simulates a gateway for local dev, tests, and demos — no external
 * network, no card data. The confirm `input.outcome` selector drives
 * success / decline / timeout, mirroring the sync and error paths a
 * real hosted-checkout adapter would surface.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";

  // The mock needs nothing from the request — a real adapter would send
  // amount/currency to its gateway here.
  async createIntent(): Promise<PaymentIntentResponse> {
    return { providerReference: `mock_${randomUUID()}` };
  }

  async confirmPayment(_providerReference: string, input: Record<string, unknown>): Promise<PaymentConfirmation> {
    switch (input.outcome) {
      case "success":
        return { status: "Succeeded" };
      case "decline":
        return { status: "Failed", failureReason: "Payment was declined (mock)." };
      case "timeout":
        throw new PaymentProviderTimeoutError();
      default:
        return { status: "Failed", failureReason: `Unknown mock outcome "${String(input.outcome)}".` };
    }
  }
}
