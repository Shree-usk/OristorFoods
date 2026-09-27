import { describe, expect, it } from "vitest";
import { buildBlogChipHref } from "@/lib/blog-chip-href";

describe("buildBlogChipHref", () => {
  it("combines a new filter with the other one already active", () => {
    expect(buildBlogChipHref({ tag: "spices" }, { author: "amara-perera" })).toBe("/blog?tag=spices&author=amara-perera");
    expect(buildBlogChipHref({ author: "amara-perera" }, { tag: "spices" })).toBe("/blog?tag=spices&author=amara-perera");
  });

  it("clears the tag filter via an explicit undefined override while preserving author", () => {
    // Regression test: overrides.tag !== undefined can't distinguish "the
    // key was passed as undefined" from "the key was omitted", which made
    // the 'All tags' reset chip a silent no-op.
    expect(buildBlogChipHref({ tag: "spices", author: "amara-perera" }, { tag: undefined })).toBe("/blog?author=amara-perera");
  });

  it("clears the author filter via an explicit undefined override while preserving tag", () => {
    expect(buildBlogChipHref({ tag: "spices", author: "amara-perera" }, { author: undefined })).toBe("/blog?tag=spices");
  });

  it("returns the bare /blog path once both filters are cleared", () => {
    expect(buildBlogChipHref({ tag: "spices" }, { tag: undefined })).toBe("/blog");
  });

  it("leaves the active filter alone when the override key is omitted entirely", () => {
    expect(buildBlogChipHref({ tag: "spices", author: "amara-perera" }, {})).toBe("/blog?tag=spices&author=amara-perera");
  });
});
