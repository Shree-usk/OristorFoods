import { describe, expect, it } from "vitest";

import { compareIdsSchema } from "@/validation/product-compare.schema";

describe("compareIdsSchema", () => {
  it("parses a comma-separated string into an array", () => {
    const result = compareIdsSchema.safeParse("p1,p2,p3");

    expect(result.success).toBe(true);
    expect(result.success && result.data).toEqual(["p1", "p2", "p3"]);
  });

  it("dedupes repeated ids", () => {
    const result = compareIdsSchema.safeParse("p1,p2,p1");

    expect(result.success).toBe(true);
    expect(result.success && result.data).toEqual(["p1", "p2"]);
  });

  it("trims whitespace and drops empty segments", () => {
    const result = compareIdsSchema.safeParse(" p1 , , p2 ");

    expect(result.success).toBe(true);
    expect(result.success && result.data).toEqual(["p1", "p2"]);
  });

  it("rejects more than 4 ids", () => {
    const result = compareIdsSchema.safeParse("p1,p2,p3,p4,p5");

    expect(result.success).toBe(false);
  });

  it("rejects an empty string", () => {
    const result = compareIdsSchema.safeParse("");

    expect(result.success).toBe(false);
  });

  it("accepts exactly 4 ids", () => {
    const result = compareIdsSchema.safeParse("p1,p2,p3,p4");

    expect(result.success).toBe(true);
    expect(result.success && result.data).toHaveLength(4);
  });

  it("accepts a single id", () => {
    const result = compareIdsSchema.safeParse("p1");

    expect(result.success).toBe(true);
    expect(result.success && result.data).toEqual(["p1"]);
  });
});
