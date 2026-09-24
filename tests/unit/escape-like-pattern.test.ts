import { describe, expect, it } from "vitest";

import { escapeLikePattern } from "@/lib/escape-like-pattern";

describe("escapeLikePattern", () => {
  it("leaves ordinary words unchanged", () => {
    expect(escapeLikePattern("sambol")).toBe("sambol");
  });

  it("escapes %, _ and backslash so they match literally", () => {
    expect(escapeLikePattern("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});
