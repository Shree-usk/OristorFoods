import { describe, expect, it } from "vitest";
import { formatScaledQuantity, scaleNutritionValue, scaleQuantity } from "@/lib/recipe-scaling";

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
});

describe("scaleNutritionValue", () => {
  it("scales proportionally to the new serving count", () => {
    expect(scaleNutritionValue(400, 4, 8)).toBe(800);
  });

  it("returns null for a null base value", () => {
    expect(scaleNutritionValue(null, 4, 8)).toBeNull();
  });
});
