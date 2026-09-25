import { describe, expect, it } from "vitest";
import { formatIngredientLine, formatScaledQuantity, scaleQuantity } from "@/lib/recipe-scaling";

describe("scaleQuantity", () => {
  it("scales proportionally", () => {
    expect(scaleQuantity(2, 4, 8)).toBe(4);
    expect(scaleQuantity(1, 4, 2)).toBe(0.5);
  });

  it("returns the base value unchanged when target equals base", () => {
    expect(scaleQuantity(3, 4, 4)).toBe(3);
  });

  it("never returns a negative or infinite value at the extremes", () => {
    expect(scaleQuantity(1, 4, 1)).toBeGreaterThan(0);
    expect(scaleQuantity(1, 4, 50)).toBeLessThan(Infinity);
  });
});

describe("formatScaledQuantity", () => {
  it("rounds whole-count units to whole numbers", () => {
    expect(formatScaledQuantity(2.6, "egg")).toBe("3");
  });

  it("rounds other units to one decimal place, dropping a trailing .0", () => {
    expect(formatScaledQuantity(1.5, "cup")).toBe("1.5");
    expect(formatScaledQuantity(2, "tbsp")).toBe("2");
  });

  it("treats whole/large/medium/small as whole-count units", () => {
    expect(formatScaledQuantity(3.5, "large")).toBe("4");
    expect(formatScaledQuantity(2.4, "medium")).toBe("2");
    expect(formatScaledQuantity(1.5, "small")).toBe("2");
  });

  it("never rounds a positive whole-count quantity down to 0", () => {
    expect(formatScaledQuantity(0.3, "whole")).toBe("1");
    expect(formatScaledQuantity(0.4, "egg")).toBe("1");
  });

  it("still rounds a zero or negative whole-count quantity to 0", () => {
    expect(formatScaledQuantity(0, "egg")).toBe("0");
  });
});

describe("formatIngredientLine", () => {
  it("composes quantity + unit + displayText", () => {
    expect(
      formatIngredientLine({ quantity: 2, unit: "tbsp", displayText: "Curry Powder" }, "2"),
    ).toBe("2 tbsp Curry Powder");
  });

  it("composes quantity + displayText when there is no unit", () => {
    expect(formatIngredientLine({ quantity: 2, unit: null, displayText: "Limes" }, "2")).toBe("2 Limes");
  });

  it("falls back to displayText alone when there is no quantity", () => {
    expect(
      formatIngredientLine({ quantity: null, unit: null, displayText: "Salt, to taste" }, null),
    ).toBe("Salt, to taste");
  });
});
