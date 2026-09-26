import { describe, expect, it } from "vitest";
import { foodAcademyListQuerySchema, foodAcademySlugParamSchema } from "@/validation/food-academy.schema";

describe("foodAcademyListQuerySchema", () => {
  it("defaults page/pageSize and leaves category/contentType undefined when absent", () => {
    const result = foodAcademyListQuerySchema.parse({});
    expect(result).toMatchObject({ page: 1, pageSize: 12 });
    expect(result.category).toBeUndefined();
    expect(result.contentType).toBeUndefined();
  });

  it("passes through a category filter", () => {
    expect(foodAcademyListQuerySchema.parse({ category: "spice-guide" }).category).toBe("spice-guide");
  });

  it("only accepts a recognized contentType value", () => {
    expect(foodAcademyListQuerySchema.parse({ contentType: "Course" }).contentType).toBe("Course");
    expect(foodAcademyListQuerySchema.parse({ contentType: "not-a-real-type" }).contentType).toBeUndefined();
  });

  it("falls back to defaults for malformed page/pageSize", () => {
    expect(foodAcademyListQuerySchema.parse({ page: "not-a-number", pageSize: "-5" })).toMatchObject({ page: 1, pageSize: 12 });
  });
});

describe("foodAcademySlugParamSchema", () => {
  it("accepts a non-empty slug", () => {
    expect(foodAcademySlugParamSchema.safeParse({ slug: "spice-tempering-101" }).success).toBe(true);
  });
  it("rejects an empty slug", () => {
    expect(foodAcademySlugParamSchema.safeParse({ slug: "" }).success).toBe(false);
  });
});
