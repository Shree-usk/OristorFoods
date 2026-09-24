import { act, renderHook } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

import { useRecipeListingParams } from "@/hooks/use-recipe-listing-params";
import { serializeRecipeListing } from "@/lib/recipe-listing-params";

describe("useRecipeListingParams", () => {
  it("defaults sort to newest and page to 1", () => {
    const { result } = renderHook(() => useRecipeListingParams(), { wrapper: withNuqsTestingAdapter() });
    const [params] = result.current;

    expect(params.sort).toBe("newest");
    expect(params.page).toBe(1);
    expect(params.category).toBeNull();
  });

  it("reads comma-separated lists from the URL", () => {
    const { result } = renderHook(() => useRecipeListingParams(), {
      wrapper: withNuqsTestingAdapter({ searchParams: "?difficulty=easy,medium&time=15-30&diet=vegan,spicy&category=curries" }),
    });
    const [params] = result.current;

    expect(params.difficulty).toEqual(["easy", "medium"]);
    expect(params.time).toEqual(["15-30"]);
    expect(params.diet).toEqual(["vegan", "spicy"]);
    expect(params.category).toBe("curries");
  });

  it("pushes a history entry by default so Back restores the previous filters", async () => {
    const onUrlUpdate = vi.fn();
    const { result } = renderHook(() => useRecipeListingParams(), {
      wrapper: withNuqsTestingAdapter({ onUrlUpdate }),
    });

    await act(async () => {
      await result.current[1]({ category: "curries" });
    });

    expect(onUrlUpdate).toHaveBeenCalledWith(expect.objectContaining({ queryString: "?category=curries" }));
    expect(onUrlUpdate.mock.calls[0][0].options.history).toBe("push");
  });
});

describe("serializeRecipeListing", () => {
  it("omits defaults and empty values", () => {
    expect(serializeRecipeListing("/recipes", { category: "curries", sort: "newest", page: 1 })).toBe("/recipes?category=curries");
    expect(serializeRecipeListing("/recipes", { category: null })).toBe("/recipes");
  });
});
