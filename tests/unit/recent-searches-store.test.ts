import { beforeEach, describe, expect, it } from "vitest";

import { useRecentSearchesStore } from "@/lib/stores/recent-searches-store";

describe("useRecentSearchesStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useRecentSearchesStore.setState({ queries: [] });
  });

  it("adds a query to the front of the list", () => {
    useRecentSearchesStore.getState().add("curry");

    expect(useRecentSearchesStore.getState().queries).toEqual(["curry"]);
  });

  it("moves a re-searched query to the front instead of duplicating it, case-insensitively", () => {
    useRecentSearchesStore.getState().add("curry");
    useRecentSearchesStore.getState().add("chilli");
    useRecentSearchesStore.getState().add("Curry");

    expect(useRecentSearchesStore.getState().queries).toEqual(["Curry", "chilli"]);
  });

  it("caps the list at 5 queries", () => {
    for (let i = 0; i < 8; i++) useRecentSearchesStore.getState().add(`query-${i}`);

    expect(useRecentSearchesStore.getState().queries).toHaveLength(5);
  });
});
