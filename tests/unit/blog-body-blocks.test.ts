import { describe, expect, it } from "vitest";
import { parseBodyBlocks } from "@/lib/blog-body-blocks";

describe("parseBodyBlocks", () => {
  it("returns the whole content as one markdown block when there are no embed tokens", () => {
    const content = "## Heading\n\nSome text here.\n\nMore text.";
    expect(parseBodyBlocks(content)).toEqual([{ kind: "markdown", content }]);
  });

  it("splits out a recipe embed token on its own line into its own block", () => {
    const content = "Intro paragraph.\n\n[[recipe:sri-lankan-chicken-curry]]\n\nClosing paragraph.";
    expect(parseBodyBlocks(content)).toEqual([
      { kind: "markdown", content: "Intro paragraph." },
      { kind: "recipeEmbed", slug: "sri-lankan-chicken-curry" },
      { kind: "markdown", content: "Closing paragraph." },
    ]);
  });

  it("splits out a video embed token on its own line into its own block", () => {
    const content = "Watch this:\n\n[[video:https://www.youtube.com/watch?v=abc123]]\n\nWasn't that great?";
    expect(parseBodyBlocks(content)).toEqual([
      { kind: "markdown", content: "Watch this:" },
      { kind: "videoEmbed", url: "https://www.youtube.com/watch?v=abc123" },
      { kind: "markdown", content: "Wasn't that great?" },
    ]);
  });

  it("handles multiple embeds and merges adjacent markdown blocks correctly", () => {
    const content = "A\n\n[[recipe:one]]\n\n[[recipe:two]]\n\nB";
    expect(parseBodyBlocks(content)).toEqual([
      { kind: "markdown", content: "A" },
      { kind: "recipeEmbed", slug: "one" },
      { kind: "recipeEmbed", slug: "two" },
      { kind: "markdown", content: "B" },
    ]);
  });

  it("does not treat an embed-like token inside a larger paragraph as an embed", () => {
    const content = "Text mentioning [[recipe:not-a-real-embed]] inline, not on its own line, should stay as markdown.";
    expect(parseBodyBlocks(content)).toEqual([{ kind: "markdown", content }]);
  });

  it("returns an empty array for empty content", () => {
    expect(parseBodyBlocks("")).toEqual([]);
    expect(parseBodyBlocks("   \n\n  ")).toEqual([]);
  });
});
