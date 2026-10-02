import { describe, expect, it } from "vitest";

import { parseSimpleCsv } from "@/lib/csv";

describe("parseSimpleCsv", () => {
  it("parses plain comma-separated rows", () => {
    expect(parseSimpleCsv("/a,/b,301\n/c,/d,302")).toEqual([
      ["/a", "/b", "301"],
      ["/c", "/d", "302"],
    ]);
  });

  it("trims whitespace around cells and lines", () => {
    expect(parseSimpleCsv("  /a , /b , 301  \n")).toEqual([["/a", "/b", "301"]]);
  });

  it("skips blank lines", () => {
    expect(parseSimpleCsv("/a,/b,301\n\n\n/c,/d,302\n")).toEqual([
      ["/a", "/b", "301"],
      ["/c", "/d", "302"],
    ]);
  });

  it("handles CRLF and bare CR line endings", () => {
    expect(parseSimpleCsv("/a,/b,301\r\n/c,/d,302\r/e,/f,301")).toEqual([
      ["/a", "/b", "301"],
      ["/c", "/d", "302"],
      ["/e", "/f", "301"],
    ]);
  });

  it("does not special-case a header row — the caller decides", () => {
    expect(parseSimpleCsv("sourcePath,destinationPath,statusCode\n/a,/b,301")).toEqual([
      ["sourcePath", "destinationPath", "statusCode"],
      ["/a", "/b", "301"],
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseSimpleCsv("")).toEqual([]);
    expect(parseSimpleCsv("   \n  \n")).toEqual([]);
  });
});
