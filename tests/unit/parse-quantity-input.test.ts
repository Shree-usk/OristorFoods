import { describe, expect, it } from "vitest";

import { parseQuantityInput } from "@/lib/parse-quantity-input";

describe("parseQuantityInput", () => {
  it("parses plain decimals", () => {
    expect(parseQuantityInput("2")).toBe(2);
    expect(parseQuantityInput("0.5")).toBe(0.5);
  });

  it("parses simple fractions", () => {
    expect(parseQuantityInput("1/2")).toBe(0.5);
    expect(parseQuantityInput("3/4")).toBe(0.75);
  });

  it("parses mixed numbers", () => {
    expect(parseQuantityInput("1 1/2")).toBe(1.5);
    expect(parseQuantityInput("2 3/4")).toBe(2.75);
  });

  it("returns undefined for an empty or whitespace-only string", () => {
    expect(parseQuantityInput("")).toBeUndefined();
    expect(parseQuantityInput("   ")).toBeUndefined();
  });

  it("returns NaN for a zero denominator rather than throwing", () => {
    expect(parseQuantityInput("1/0")).toBeNaN();
    expect(parseQuantityInput("1 1/0")).toBeNaN();
  });

  it("falls through to Number() for anything else, including garbage input", () => {
    expect(parseQuantityInput("abc")).toBeNaN();
  });
});
