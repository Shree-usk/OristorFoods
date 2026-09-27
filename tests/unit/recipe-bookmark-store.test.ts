// tests/unit/recipe-bookmark-store.test.ts
import { beforeEach, describe, expect, it } from "vitest";

import { useRecipeBookmarkStore } from "@/lib/stores/recipe-bookmark-store";

beforeEach(() => {
  localStorage.clear();
  useRecipeBookmarkStore.setState({ items: [] });
});

describe("useRecipeBookmarkStore", () => {
  it("adds a recipe id", () => {
    useRecipeBookmarkStore.getState().add("r1");
    expect(useRecipeBookmarkStore.getState().items).toEqual(["r1"]);
  });

  it("does not add a duplicate", () => {
    useRecipeBookmarkStore.getState().add("r1");
    useRecipeBookmarkStore.getState().add("r1");
    expect(useRecipeBookmarkStore.getState().items).toEqual(["r1"]);
  });

  it("removes a recipe id", () => {
    useRecipeBookmarkStore.getState().add("r1");
    useRecipeBookmarkStore.getState().remove("r1");
    expect(useRecipeBookmarkStore.getState().items).toEqual([]);
  });

  it("has() reflects current membership", () => {
    useRecipeBookmarkStore.getState().add("r1");
    expect(useRecipeBookmarkStore.getState().has("r1")).toBe(true);
    expect(useRecipeBookmarkStore.getState().has("r2")).toBe(false);
  });

  it("clear() empties the list", () => {
    useRecipeBookmarkStore.getState().add("r1");
    useRecipeBookmarkStore.getState().add("r2");
    useRecipeBookmarkStore.getState().clear();
    expect(useRecipeBookmarkStore.getState().items).toEqual([]);
  });

  it("persists across store instances via localStorage", () => {
    useRecipeBookmarkStore.getState().add("r1");
    expect(localStorage.getItem("oristor-recipe-bookmarks")).toContain("r1");
  });
});
