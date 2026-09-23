// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

describe("purchase verifier registry", () => {
  it("is shared across separately loaded copies of the module", async () => {
    // Next.js bundles src/instrumentation.ts separately from route code, so
    // the module that registers a verifier is not the same module instance
    // that reads it. The registry lives on globalThis to survive that (see
    // the equivalent test for product-detail-extensions.ts's provider
    // registry in review-summary-provider.test.ts).
    const first = await import("@/services/purchase-verification");
    vi.resetModules();
    const second = await import("@/services/purchase-verification");
    expect(second).not.toBe(first);

    first.registerPurchaseVerifier(async () => true);

    expect(await second.hasPurchasedProduct("any-user", "any-product")).toBe(true);

    second.resetPurchaseVerifierForTesting();
  });
});
