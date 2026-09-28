import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards the PaymentProvider abstraction boundary (STORY-026 AC): the
 * concrete payment gateway is an unconfirmed business decision, so
 * payment.service.ts must depend only on the PaymentProvider interface,
 * the mock implementation, repositories, errors, and types — never a
 * concrete gateway SDK/package. This fails loudly the moment someone
 * imports one directly instead of adding a compliant adapter file.
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

  it("names no concrete gateway anywhere in the file", () => {
    const source = readFileSync(path.resolve(__dirname, "../../src/services/payment.service.ts"), "utf-8");
    expect(source).not.toMatch(/stripe|payhere|webxpay|razorpay|paypal|braintree|adyen/i);
  });
});
