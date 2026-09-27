import { describe, expect, it } from "vitest";

import { formatFileSize } from "@/lib/format-file-size";

describe("formatFileSize", () => {
  it("formats bytes under 1KB", () => {
    expect(formatFileSize(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(2048)).toBe("2 KB");
  });

  it("formats megabytes with one decimal", () => {
    expect(formatFileSize(1_258_291)).toBe("1.2 MB");
  });

  it("formats exactly 1MB", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
  });
});
