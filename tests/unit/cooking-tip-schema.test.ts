import { describe, expect, it } from "vitest";

import { cookingTipListQuerySchema, cookingTipSlugParamSchema } from "@/validation/cooking-tip.schema";

describe("cookingTipListQuerySchema", () => {
  it("applies defaults for an empty query", () => {
    expect(cookingTipListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 12 });
  });

  it("parses topic filter with page and pageSize", () => {
    const query = cookingTipListQuerySchema.parse({
      topic: "grilling",
      page: "2",
      pageSize: "24",
    });

    expect(query).toEqual({
      topic: "grilling",
      page: 2,
      pageSize: 24,
    });
  });

  it("falls back to defaults for malformed page and pageSize", () => {
    const query = cookingTipListQuerySchema.parse({ page: "-3", pageSize: "500" });

    expect(query.page).toBe(1);
    expect(query.pageSize).toBe(12);
  });

  it("treats blank topic as absent", () => {
    expect(cookingTipListQuerySchema.parse({ topic: "  " })).toEqual({ page: 1, pageSize: 12 });
  });

  it("leaves topic undefined when absent", () => {
    expect(cookingTipListQuerySchema.parse({}).topic).toBeUndefined();
  });

  it("ignores repeated keys (arrays) rather than failing", () => {
    expect(cookingTipListQuerySchema.parse({ topic: ["grilling", "baking"] }).topic).toBeUndefined();
  });
});

describe("cookingTipSlugParamSchema", () => {
  it("accepts an object with a non-empty slug", () => {
    expect(cookingTipSlugParamSchema.safeParse({ slug: "perfect-grill" }).success).toBe(true);
  });

  it("rejects an empty slug", () => {
    expect(cookingTipSlugParamSchema.safeParse({ slug: "" }).success).toBe(false);
  });
});
