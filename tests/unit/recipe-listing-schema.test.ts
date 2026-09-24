import { describe, expect, it } from "vitest";

import { recipeListingQuerySchema } from "@/validation/recipe-listing.schema";

describe("recipeListingQuerySchema", () => {
  it("applies defaults for an empty query", () => {
    expect(recipeListingQuerySchema.parse({})).toEqual({ page: 1, pageSize: 12, sort: "newest" });
  });

  it("parses every filter", () => {
    const query = recipeListingQuerySchema.parse({
      category: "curries",
      difficulty: "easy,hard",
      time: "under-15,60-plus",
      diet: "vegan,spicy",
      q: "  deviled prawns ",
      sort: "time",
      page: "2",
      pageSize: "24",
    });

    expect(query).toEqual({
      category: "curries",
      difficulty: ["easy", "hard"],
      time: ["under-15", "60-plus"],
      diet: ["vegan", "spicy"],
      q: "deviled prawns",
      sort: "time",
      page: 2,
      pageSize: 24,
    });
  });

  it("drops unknown difficulty and time values but keeps unknown diet slugs", () => {
    const query = recipeListingQuerySchema.parse({ difficulty: "easy,expert", time: "forever", diet: "keto" });

    expect(query.difficulty).toEqual(["easy"]);
    expect(query.time).toEqual([]);
    expect(query.diet).toEqual(["keto"]);
  });

  it("falls back to defaults for malformed values instead of failing", () => {
    const query = recipeListingQuerySchema.parse({ sort: "spiciest", page: "-3", pageSize: "500" });

    expect(query.sort).toBe("newest");
    expect(query.page).toBe(1);
    expect(query.pageSize).toBe(12);
  });

  it("treats blank category and q as absent and caps q at 100 characters", () => {
    expect(recipeListingQuerySchema.parse({ category: "  ", q: "   " })).toEqual({ page: 1, pageSize: 12, sort: "newest" });
    expect(recipeListingQuerySchema.parse({ q: "a".repeat(150) }).q).toHaveLength(100);
  });

  it("ignores repeated keys (arrays) rather than failing", () => {
    expect(recipeListingQuerySchema.parse({ category: ["curries", "snacks"] }).category).toBeUndefined();
  });
});
