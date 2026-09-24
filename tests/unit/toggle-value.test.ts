import { describe, expect, it } from "vitest";

import { toggleValue } from "@/lib/toggle-value";

describe("toggleValue", () => {
  it("adds a value that isn't in the list", () => {
    expect(toggleValue(["easy"], "hard")).toEqual(["easy", "hard"]);
  });

  it("removes a value that is in the list", () => {
    expect(toggleValue(["easy", "hard"], "easy")).toEqual(["hard"]);
  });

  it("does not mutate the input list", () => {
    const list = ["easy"] as const;
    toggleValue(list, "hard");
    expect(list).toEqual(["easy"]);
  });
});
