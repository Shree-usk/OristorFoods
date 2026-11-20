import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { computeNotifySignature, formatPayHereAmount, generateCheckoutHash, verifyNotifySignature } from "@/services/payment/payhere-signature";

/**
 * These check the implementation is self-consistent with PayHere's
 * documented formula shape (independently reimplemented here, not
 * imported from the module under test) and structurally correct (32
 * uppercase hex chars, every input actually affects the output). There is
 * no real PayHere merchant/sandbox account yet to validate against a
 * genuine official example — see docs/PAYHERE_GO_LIVE_CHECKLIST.md, which
 * calls out re-confirming this against a real sandbox transaction before
 * go-live as an outstanding step.
 */
function referenceCheckoutHash(merchantId: string, orderId: string, amount: string, currency: string, merchantSecret: string): string {
  const secretDigest = createHash("md5").update(merchantSecret).digest("hex").toUpperCase();
  return createHash("md5").update(`${merchantId}${orderId}${amount}${currency}${secretDigest}`).digest("hex").toUpperCase();
}

describe("formatPayHereAmount", () => {
  it("always renders exactly two decimal places with a '.' separator and no thousands grouping", () => {
    expect(formatPayHereAmount(1000)).toBe("1000.00");
    expect(formatPayHereAmount(1234.5)).toBe("1234.50");
    expect(formatPayHereAmount(99.999)).toBe("100.00");
  });
});

describe("generateCheckoutHash", () => {
  const base = { merchantId: "1211149", orderId: "payhere_abc123", amount: 1000, currency: "LKR", merchantSecret: "test-secret-value" };

  it("matches an independent reimplementation of PayHere's documented formula", () => {
    const expected = referenceCheckoutHash(base.merchantId, base.orderId, formatPayHereAmount(base.amount), base.currency, base.merchantSecret);
    expect(generateCheckoutHash(base)).toBe(expected);
  });

  it("is 32 uppercase hex characters", () => {
    expect(generateCheckoutHash(base)).toMatch(/^[0-9A-F]{32}$/);
  });

  it("is deterministic for identical inputs", () => {
    expect(generateCheckoutHash(base)).toBe(generateCheckoutHash({ ...base }));
  });

  it.each(["merchantId", "orderId", "currency", "merchantSecret"] as const)("changes when %s changes", (field) => {
    const mutated = { ...base, [field]: `${base[field]}-different` };
    expect(generateCheckoutHash(mutated)).not.toBe(generateCheckoutHash(base));
  });

  it("changes when the amount changes", () => {
    expect(generateCheckoutHash({ ...base, amount: 1000.01 })).not.toBe(generateCheckoutHash(base));
  });
});

describe("verifyNotifySignature", () => {
  const fields = { merchantId: "1211149", orderId: "payhere_abc123", payhereAmount: "1000.00", payhereCurrency: "LKR", statusCode: "2" };
  const secret = "test-secret-value";

  it("accepts the correctly computed signature", () => {
    const signature = computeNotifySignature(fields, secret);
    expect(verifyNotifySignature(fields, secret, signature)).toBe(true);
  });

  it("accepts a lowercase rendering of the correct signature", () => {
    const signature = computeNotifySignature(fields, secret).toLowerCase();
    expect(verifyNotifySignature(fields, secret, signature)).toBe(true);
  });

  it.each(["merchantId", "orderId", "payhereAmount", "payhereCurrency", "statusCode"] as const)("rejects when %s is tampered with after signing", (field) => {
    const signature = computeNotifySignature(fields, secret);
    const tampered = { ...fields, [field]: `${fields[field]}-tampered` };
    expect(verifyNotifySignature(tampered, secret, signature)).toBe(false);
  });

  it("rejects a signature signed with the wrong merchant secret", () => {
    const signature = computeNotifySignature(fields, "wrong-secret");
    expect(verifyNotifySignature(fields, secret, signature)).toBe(false);
  });

  it("rejects a garbage signature without throwing", () => {
    expect(verifyNotifySignature(fields, secret, "not-a-valid-signature")).toBe(false);
  });
});
