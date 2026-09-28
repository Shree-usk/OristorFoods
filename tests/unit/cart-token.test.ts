// tests/unit/cart-token.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { signCartToken, verifyCartCookieValue } from "@/lib/cart-token";

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", "test-secret-for-cart-token-tests");
});

describe("signCartToken / verifyCartCookieValue", () => {
  it("round-trips: a freshly signed token verifies back to its own raw token", () => {
    const { token, cookieValue } = signCartToken();
    expect(verifyCartCookieValue(cookieValue)).toBe(token);
  });

  it("produces a token with high enough entropy to be effectively unguessable", () => {
    const a = signCartToken();
    const b = signCartToken();
    expect(a.token).not.toBe(b.token);
    expect(a.token.length).toBeGreaterThanOrEqual(24);
  });

  it("rejects a cookie value with a tampered signature", () => {
    const { cookieValue } = signCartToken();
    const [token] = cookieValue.split(".");
    const tampered = `${token}.not-the-real-signature`;
    expect(verifyCartCookieValue(tampered)).toBeNull();
  });

  it("rejects a cookie value with a tampered token but the original signature", () => {
    const { cookieValue } = signCartToken();
    const [, signature] = cookieValue.split(".");
    const tampered = `some-other-token.${signature}`;
    expect(verifyCartCookieValue(tampered)).toBeNull();
  });

  it("rejects undefined, empty, and malformed input without throwing", () => {
    expect(verifyCartCookieValue(undefined)).toBeNull();
    expect(verifyCartCookieValue("")).toBeNull();
    expect(verifyCartCookieValue("no-dot-separator")).toBeNull();
    expect(verifyCartCookieValue("too.many.dots.here")).toBeNull();
  });

  it("rejects a well-formed but never-signed token (forged from scratch)", () => {
    expect(verifyCartCookieValue("aGVsbG8.deadbeefdeadbeefdeadbeefdeadbeef")).toBeNull();
  });
});
