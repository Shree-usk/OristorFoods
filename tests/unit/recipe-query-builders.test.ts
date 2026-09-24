// @vitest-environment node
import { describe, expect, it } from "vitest";

import { recipeSortValues } from "@/lib/recipe-listing-values";
import { buildRecipeOrderBy, buildRecipeWhere } from "@/repositories/recipe.repository";

describe("buildRecipeWhere", () => {
  it("filters on Published only when no filters are given", () => {
    expect(buildRecipeWhere({})).toEqual({ AND: [{ status: "Published" }] });
  });

  it("always keeps Published as the first condition", () => {
    const where = buildRecipeWhere({
      category: "curries",
      difficulty: ["easy"],
      time: ["under-15"],
      diet: ["vegan"],
      q: "dhal",
    });

    expect(where.AND[0]).toEqual({ status: "Published" });
    expect(where.AND).toHaveLength(6);
  });

  it("filters an Active category by slug", () => {
    expect(buildRecipeWhere({ category: "curries" }).AND).toContainEqual({
      category: { is: { slug: "curries", status: "Active" } },
    });
  });

  it("maps difficulty params to enum values (OR)", () => {
    expect(buildRecipeWhere({ difficulty: ["easy", "hard"] }).AND).toContainEqual({
      difficulty: { in: ["Easy", "Hard"] },
    });
  });

  it("ORs half-open time ranges on totalTimeMinutes", () => {
    expect(buildRecipeWhere({ time: ["under-15", "30-60", "60-plus"] }).AND).toContainEqual({
      OR: [
        { totalTimeMinutes: { lt: 15 } },
        { totalTimeMinutes: { gte: 30, lt: 60 } },
        { totalTimeMinutes: { gte: 60 } },
      ],
    });
  });

  it("requires every selected dietary tag (one condition per tag)", () => {
    const and = buildRecipeWhere({ diet: ["vegan", "spicy"] }).AND;

    expect(and).toContainEqual({ dietaryTags: { some: { dietaryTag: { slug: "vegan", status: "Active" } } } });
    expect(and).toContainEqual({ dietaryTags: { some: { dietaryTag: { slug: "spicy", status: "Active" } } } });
  });

  it("requires every search word in the title or short description, with wildcards escaped", () => {
    const and = buildRecipeWhere({ q: "  deviled   100% " }).AND;

    expect(and).toContainEqual({
      OR: [
        { title: { contains: "deviled", mode: "insensitive" } },
        { shortDescription: { contains: "deviled", mode: "insensitive" } },
      ],
    });
    expect(and).toContainEqual({
      OR: [
        { title: { contains: "100\\%", mode: "insensitive" } },
        { shortDescription: { contains: "100\\%", mode: "insensitive" } },
      ],
    });
    expect(and).toHaveLength(3);
  });

  it("ignores empty lists and blank search", () => {
    expect(buildRecipeWhere({ difficulty: [], time: [], diet: [], q: "   " })).toEqual({ AND: [{ status: "Published" }] });
  });
});

describe("buildRecipeOrderBy", () => {
  it("orders each sort as specified", () => {
    expect(buildRecipeOrderBy("newest")).toEqual([{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }]);
    expect(buildRecipeOrderBy("popular")).toEqual([{ viewCount: "desc" }, { id: "asc" }]);
    expect(buildRecipeOrderBy("rating")).toEqual([
      { avgRating: { sort: "desc", nulls: "last" } },
      { ratingCount: "desc" },
      { id: "asc" },
    ]);
    expect(buildRecipeOrderBy("time")).toEqual([{ totalTimeMinutes: "asc" }, { id: "asc" }]);
  });

  it("ends every sort with the id tiebreaker", () => {
    for (const sort of recipeSortValues) {
      expect(buildRecipeOrderBy(sort).at(-1)).toEqual({ id: "asc" });
    }
  });
});
