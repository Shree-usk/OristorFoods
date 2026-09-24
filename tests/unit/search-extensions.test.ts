import { afterEach, describe, expect, it, vi } from "vitest";

import {
  registerRecipeSearchProvider,
  resetSearchExtensionsForTesting,
  searchRecipes,
} from "@/services/search-extensions";

afterEach(() => {
  resetSearchExtensionsForTesting();
});

describe("search-extensions", () => {
  it("returns an empty array before a provider is registered", async () => {
    expect(await searchRecipes("curry", 3)).toEqual([]);
  });

  it("returns the registered provider's result", async () => {
    registerRecipeSearchProvider(async (query, limit) => [
      { id: "r1", label: `Recipe for ${query}`, href: "/recipes/r1", type: "Recipe" as const },
    ].slice(0, limit));

    const result = await searchRecipes("curry", 3);

    expect(result).toEqual([{ id: "r1", label: "Recipe for curry", href: "/recipes/r1", type: "Recipe" }]);
  });

  it("resets to the stub after resetSearchExtensionsForTesting", async () => {
    registerRecipeSearchProvider(async () => [
      { id: "r1", label: "Recipe", href: "/recipes/r1", type: "Recipe" },
    ]);
    resetSearchExtensionsForTesting();

    expect(await searchRecipes("curry", 3)).toEqual([]);
  });

  it("keeps the provider on globalThis so a separately bundled copy of the module sees it", async () => {
    const item = { id: "r1", label: "Dhal Curry", href: "/recipes/dhal-curry", type: "Recipe" as const };
    registerRecipeSearchProvider(async () => [item]);

    vi.resetModules();
    const freshCopy = await import("@/services/search-extensions");

    expect(await freshCopy.searchRecipes("dhal", 3)).toEqual([item]);
  });
});
