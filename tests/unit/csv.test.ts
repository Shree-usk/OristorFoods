import { describe, expect, it } from "vitest";

import { parseSimpleCsv, toCsv } from "@/lib/csv";

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

// STORY-059b. toCsv is the write-side counterpart, extracted from
// audit-log-admin.service.ts's original inline builder (STORY-057).
describe("toCsv", () => {
  it("joins headers and rows with commas and newlines", () => {
    expect(toCsv(["A", "B"], [["1", "2"], ["3", "4"]])).toBe("A,B\n1,2\n3,4");
  });

  it("quotes and escapes a field containing a comma, quote, or newline", () => {
    expect(toCsv(["Note"], [['has, a comma and "quotes"']])).toBe('Note\n"has, a comma and ""quotes"""');
    expect(toCsv(["Note"], [["line1\nline2"]])).toBe('Note\n"line1\nline2"');
  });

  it("produces just the header row for no data rows", () => {
    expect(toCsv(["A", "B"], [])).toBe("A,B");
  });
});
