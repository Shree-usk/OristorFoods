import { describe, expect, it } from "vitest";

import { buildDownloadChipHref } from "@/lib/download-chip-href";

describe("buildDownloadChipHref", () => {
  it("builds a plain /downloads href with no category", () => {
    expect(buildDownloadChipHref({}, {})).toBe("/downloads");
  });

  it("builds an href with the overridden category", () => {
    expect(buildDownloadChipHref({}, { category: "nutrition-guides" })).toBe("/downloads?category=nutrition-guides");
  });

  it("preserves the current category when not overridden", () => {
    expect(buildDownloadChipHref({ category: "nutrition-guides" }, {})).toBe("/downloads?category=nutrition-guides");
  });

  it("explicitly clears the category when overridden with undefined (the 'All' chip)", () => {
    expect(buildDownloadChipHref({ category: "nutrition-guides" }, { category: undefined })).toBe("/downloads");
  });
});
