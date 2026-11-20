import { MockPaymentProvider } from "@/services/payment/mock-payment.provider";
import { PayHereProvider } from "@/services/payment/payhere-payment.provider";
import type { PaymentProvider } from "@/services/payment/payment-provider.interface";

/**
 * The ONE place a concrete `PaymentProvider` implementation is named.
 * `payment.service.ts::getActiveProvider()` reads `PAYMENT_PROVIDER` and
 * calls into this map rather than importing a concrete provider file
 * itself — see `tests/unit/payment-service-boundary.test.ts`, which
 * asserts `payment.service.ts` never imports a provider directly. Adding
 * a new gateway means adding one entry here, nothing else.
 *
 * Registering "payhere" here does NOT activate it — `PAYMENT_PROVIDER`
 * must still be explicitly set to `"payhere"` (and real/sandbox
 * credentials provided) for it to ever be selected; it defaults to
 * `"mock"` everywhere until a separate go-live decision.
 */
const PROVIDER_FACTORIES: Record<string, () => PaymentProvider> = {
  mock: () => new MockPaymentProvider(),
  payhere: () => new PayHereProvider(),
};

export function createProviderByName(name: string): PaymentProvider | null {
  const factory = PROVIDER_FACTORIES[name];
  return factory ? factory() : null;
}
