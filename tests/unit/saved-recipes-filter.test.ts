// @vitest-environment node
import { describe, expect, it } from "vitest";

import { filterAndSortSavedRecipes } from "@/lib/saved-recipes-filter";
import type { RecipeCard } from "@/types/recipe";

function makeRecipe(overrides: Partial<RecipeCard>): RecipeCard {
  return {
    id: overrides.id ?? "id",
    slug: overrides.slug ?? "slug",
    href: overrides.href ?? "/recipes/slug",
    title: overrides.title ?? "Title",
    heroImage: "",
    heroImageAlt: "",
    categoryName: overrides.categoryName ?? "Category",
    cuisine: null,
    difficulty: "Easy",
    totalTimeMinutes: 30,
    avgRating: null,
    ratingCount: 0,
    dietaryTags: [],
    hasVideo: false,
    ...overrides,
  };
}

describe("saved-recipes-filter", () => {
  describe("filterAndSortSavedRecipes (pure)", () => {
    it("returns an empty array unchanged", () => {
      expect(filterAndSortSavedRecipes([], { sort: "dateSaved" })).toEqual([]);
    });

    it("preserves input order for dateSaved (already most-recently-bookmarked-first)", () => {
      const recipes = [makeRecipe({ id: "1", title: "Zebra Curry" }), makeRecipe({ id: "2", title: "Apple Pie" })];
      expect(filterAndSortSavedRecipes(recipes, { sort: "dateSaved" }).map((r) => r.id)).toEqual(["1", "2"]);
    });

    it("sorts alphabetically by title", () => {
      const recipes = [makeRecipe({ id: "1", title: "Zebra Curry" }), makeRecipe({ id: "2", title: "Apple Pie" })];
      expect(filterAndSortSavedRecipes(recipes, { sort: "alphabetical" }).map((r) => r.id)).toEqual(["2", "1"]);
    });

    it("filters by exact category name match", () => {
      const recipes = [
        makeRecipe({ id: "1", categoryName: "Curries" }),
        makeRecipe({ id: "2", categoryName: "Desserts" }),
        makeRecipe({ id: "3", categoryName: "Curries" }),
      ];
      const result = filterAndSortSavedRecipes(recipes, { category: "Curries", sort: "dateSaved" });
      expect(result.map((r) => r.id)).toEqual(["1", "3"]);
    });

    it("combines category filter and alphabetical sort", () => {
      const recipes = [
        makeRecipe({ id: "1", title: "Zebra Curry", categoryName: "Curries" }),
        makeRecipe({ id: "2", title: "Apple Pie", categoryName: "Desserts" }),
        makeRecipe({ id: "3", title: "Mango Curry", categoryName: "Curries" }),
      ];
      const result = filterAndSortSavedRecipes(recipes, { category: "Curries", sort: "alphabetical" });
      expect(result.map((r) => r.id)).toEqual(["3", "1"]);
    });
  });
});
