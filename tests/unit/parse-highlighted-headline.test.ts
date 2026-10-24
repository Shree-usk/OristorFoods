import { describe, expect, it } from "vitest";

import { parseHighlightedHeadline } from "@/components/storefront/home/export-hero";

describe("parseHighlightedHeadline", () => {
  it("returns one plain segment when there are no markers", () => {
    expect(parseHighlightedHeadline("Bring the Taste of Sri Lanka to Your Market.")).toEqual([
      { text: "Bring the Taste of Sri Lanka to Your Market.", highlighted: false },
    ]);
  });

  it("splits a single marked span into plain/highlighted/plain segments", () => {
    expect(parseHighlightedHeadline("Bring the Taste of **Sri Lanka** to Your Market.")).toEqual([
      { text: "Bring the Taste of ", highlighted: false },
      { text: "Sri Lanka", highlighted: true },
      { text: " to Your Market.", highlighted: false },
    ]);
  });

  it("highlights a span at the very start or end of the string", () => {
    expect(parseHighlightedHeadline("**Sri Lanka** to Your Market.")).toEqual([
      { text: "Sri Lanka", highlighted: true },
      { text: " to Your Market.", highlighted: false },
    ]);
    expect(parseHighlightedHeadline("Bring the Taste of **Sri Lanka**")).toEqual([
      { text: "Bring the Taste of ", highlighted: false },
      { text: "Sri Lanka", highlighted: true },
    ]);
  });

  it("renders the literal text when markers are unbalanced, instead of throwing", () => {
    expect(parseHighlightedHeadline("Bring the Taste of **Sri Lanka to Your Market.")).toEqual([
      { text: "Bring the Taste of **Sri Lanka to Your Market.", highlighted: false },
    ]);
  });
});
