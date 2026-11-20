import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards the PaymentProvider abstraction boundary (STORY-026 AC, updated
 * for the PayHere integration): payment.service.ts must depend only on
 * the PaymentProvider interface, provider-registry.ts, repositories,
 * errors, and types — never a concrete gateway SDK/package, and never a
 * concrete provider file directly (not even the mock). Provider selection
 * lives entirely in provider-registry.ts so a real gateway can be added
 * there without this file ever naming it. This fails loudly the moment
 * someone imports a concrete provider or an external SDK directly instead
 * of registering it in provider-registry.ts.
 */
describe("payment.service.ts abstraction boundary", () => {
  it("imports only internal modules — never a third-party gateway SDK", () => {
    const source = readFileSync(path.resolve(__dirname, "../../src/services/payment.service.ts"), "utf-8");
    const importSpecifiers = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
    expect(importSpecifiers.length).toBeGreaterThan(0);

    for (const specifier of importSpecifiers) {
      const isInternal = specifier.startsWith("@/") || specifier.startsWith(".");
      const isNodeBuiltin = specifier.startsWith("node:");
      expect(isInternal || isNodeBuiltin, `Unexpected external import "${specifier}" in payment.service.ts`).toBe(true);
    }
  });

  it("never imports a concrete provider file directly — only provider-registry.ts", () => {
    const source = readFileSync(path.resolve(__dirname, "../../src/services/payment.service.ts"), "utf-8");
    const importSpecifiers = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
    const providerImports = importSpecifiers.filter((specifier) => specifier.includes("/services/payment/") && !specifier.endsWith("provider-registry") && !specifier.endsWith("payment-provider.interface"));
    expect(providerImports).toEqual([]);
  });
});
