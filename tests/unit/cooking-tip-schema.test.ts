import { describe, expect, it } from "vitest";
import { cookingTipListQuerySchema, cookingTipSlugParamSchema } from "@/validation/cooking-tip.schema";

describe("cookingTipListQuerySchema", () => {
  it("defaults page/pageSize and leaves topic undefined when absent", () => {
    const result = cookingTipListQuerySchema.parse({});
    expect(result).toMatchObject({ page: 1, pageSize: 12 });
    expect(result.topic).toBeUndefined();
  });

  it("passes through a topic filter", () => {
    expect(cookingTipListQuerySchema.parse({ topic: "knife-skills" }).topic).toBe("knife-skills");
  });

  it("falls back to defaults for malformed page/pageSize", () => {
    expect(cookingTipListQuerySchema.parse({ page: "not-a-number", pageSize: "-5" })).toMatchObject({ page: 1, pageSize: 12 });
  });
});

describe("cookingTipSlugParamSchema", () => {
  it("accepts a non-empty slug", () => {
    expect(cookingTipSlugParamSchema.safeParse({ slug: "knife-basics" }).success).toBe(true);
  });
  it("rejects an empty slug", () => {
    expect(cookingTipSlugParamSchema.safeParse({ slug: "" }).success).toBe(false);
  });
});
