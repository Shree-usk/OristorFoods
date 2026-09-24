import { describe, expect, it } from "vitest";

import { computeTotalTimeMinutes, formatRecipeTime } from "@/lib/recipe-time";

describe("computeTotalTimeMinutes", () => {
  it("adds prep and cook time", () => {
    expect(computeTotalTimeMinutes(15, 45)).toBe(60);
    expect(computeTotalTimeMinutes(10, 0)).toBe(10);
  });
});

describe("formatRecipeTime", () => {
  it("shows minutes under an hour", () => {
    expect(formatRecipeTime(45)).toBe("45 min");
  });

  it("shows whole hours without minutes", () => {
    expect(formatRecipeTime(60)).toBe("1 hr");
    expect(formatRecipeTime(120)).toBe("2 hr");
  });

  it("shows hours and minutes", () => {
    expect(formatRecipeTime(90)).toBe("1 hr 30 min");
  });
});
