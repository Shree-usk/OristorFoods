import { describe, expect, it } from "vitest";
import { recipeSlugParamSchema } from "@/validation/recipe-detail.schema";

describe("recipeSlugParamSchema", () => {
  it("accepts an object with a non-empty slug", () => {
    expect(recipeSlugParamSchema.safeParse({ slug: "dhal-curry" }).success).toBe(true);
  });

  it("rejects an empty slug", () => {
    expect(recipeSlugParamSchema.safeParse({ slug: "" }).success).toBe(false);
  });
});
