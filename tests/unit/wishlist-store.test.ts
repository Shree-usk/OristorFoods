import { beforeEach, describe, expect, it } from "vitest";

import { useWishlistStore } from "@/lib/stores/wishlist-store";

beforeEach(() => {
  localStorage.clear();
  useWishlistStore.setState({ items: [] });
});

describe("useWishlistStore", () => {
  it("adds a product id", () => {
    useWishlistStore.getState().add("p1");

    expect(useWishlistStore.getState().items).toEqual(["p1"]);
  });

  it("does not add a duplicate", () => {
    useWishlistStore.getState().add("p1");
    useWishlistStore.getState().add("p1");

    expect(useWishlistStore.getState().items).toEqual(["p1"]);
  });

  it("removes a product id", () => {
    useWishlistStore.getState().add("p1");
    useWishlistStore.getState().remove("p1");

    expect(useWishlistStore.getState().items).toEqual([]);
  });

  it("has() reflects current membership", () => {
    useWishlistStore.getState().add("p1");

    expect(useWishlistStore.getState().has("p1")).toBe(true);
    expect(useWishlistStore.getState().has("p2")).toBe(false);
  });

  it("clear() empties the list", () => {
    useWishlistStore.getState().add("p1");
    useWishlistStore.getState().add("p2");

    useWishlistStore.getState().clear();

    expect(useWishlistStore.getState().items).toEqual([]);
  });

  it("persists across store instances via localStorage", () => {
    useWishlistStore.getState().add("p1");

    expect(localStorage.getItem("oristor-wishlist")).toContain("p1");
  });
});
