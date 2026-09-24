import { describe, expect, it } from "vitest";

import type { RecipeListingParams } from "@/hooks/use-recipe-listing-params";
import { buildRecipeApiSearch } from "@/hooks/use-recipe-listing";

const base: RecipeListingParams = {
  category: null,
  difficulty: null,
  time: null,
  diet: null,
  q: null,
  sort: "newest",
  page: 1,
};

describe("buildRecipeApiSearch", () => {
  it("always sends sort, page and pageSize", () => {
    expect(buildRecipeApiSearch(base, 12)).toBe("sort=newest&page=1&pageSize=12");
  });

  it("sends set filters as comma lists and trims q", () => {
    const search = new URLSearchParams(
      buildRecipeApiSearch(
        { ...base, category: "curries", difficulty: ["easy", "hard"], time: ["15-30"], diet: ["vegan"], q: "  dhal " },
        12,
      ),
    );

    expect(search.get("category")).toBe("curries");
    expect(search.get("difficulty")).toBe("easy,hard");
    expect(search.get("time")).toBe("15-30");
    expect(search.get("diet")).toBe("vegan");
    expect(search.get("q")).toBe("dhal");
  });

  it("omits empty lists and blank q", () => {
    const search = new URLSearchParams(buildRecipeApiSearch({ ...base, difficulty: [], diet: [], q: "   " }, 12));
    expect(search.has("difficulty")).toBe(false);
    expect(search.has("diet")).toBe(false);
    expect(search.has("q")).toBe(false);
  });
});
