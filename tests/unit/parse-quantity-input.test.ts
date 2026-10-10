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

  it("passes through a number as-is instead of crashing on .trim()", () => {
    // react-hook-form also runs setValueAs against the field's default
    // value, not just typed input — admin-recipe-form.tsx seeds the
    // ingredient quantity default as `Number(ingredient.quantity)`.
    expect(parseQuantityInput(500)).toBe(500);
    expect(parseQuantityInput(0.5)).toBe(0.5);
  });

  it("returns undefined for a NaN or undefined default value", () => {
    expect(parseQuantityInput(NaN)).toBeUndefined();
    expect(parseQuantityInput(undefined)).toBeUndefined();
  });
});
