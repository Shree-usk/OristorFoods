import { describe, expect, it } from "vitest";

import { searchQuerySchema } from "@/validation/search.schema";

describe("searchQuerySchema", () => {
  it("trims a valid query and defaults page to 1", () => {
    const result = searchQuerySchema.parse({ q: "  curry  " });

    expect(result).toEqual({ q: "curry", page: 1, pageSize: undefined });
  });

  it("degrades a missing q to an empty string instead of throwing", () => {
    const result = searchQuerySchema.parse({});

    expect(result.q).toBe("");
  });

  it("degrades a malformed page to 1 instead of throwing", () => {
    const result = searchQuerySchema.parse({ q: "curry", page: "not-a-number" });

    expect(result.page).toBe(1);
  });

  it("accepts an explicit pageSize override", () => {
    const result = searchQuerySchema.parse({ q: "curry", pageSize: "5" });

    expect(result.pageSize).toBe(5);
  });
});
