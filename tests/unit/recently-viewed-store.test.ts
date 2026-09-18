import { beforeEach, describe, expect, it } from "vitest";

import { useRecentlyViewedStore } from "@/lib/stores/recently-viewed-store";
import type { RecentlyViewedItem } from "@/validation/product-detail.schema";

function item(id: string): RecentlyViewedItem {
  return {
    id,
    name: `Product ${id}`,
    href: `/products/${id}`,
    imageSrc: "/x.jpg",
    imageAlt: "x",
    price: 100,
    currency: "LKR",
    inStock: true,
  };
}

describe("useRecentlyViewedStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useRecentlyViewedStore.setState({ items: [] });
  });

  it("adds an item to the front of the list", () => {
    useRecentlyViewedStore.getState().add(item("1"));

    expect(useRecentlyViewedStore.getState().items.map((i) => i.id)).toEqual(["1"]);
  });

  it("moves a re-viewed item to the front instead of duplicating it", () => {
    useRecentlyViewedStore.getState().add(item("1"));
    useRecentlyViewedStore.getState().add(item("2"));
    useRecentlyViewedStore.getState().add(item("1"));

    expect(useRecentlyViewedStore.getState().items.map((i) => i.id)).toEqual(["1", "2"]);
  });

  it("caps the list at 12 items", () => {
    for (let i = 0; i < 15; i++) useRecentlyViewedStore.getState().add(item(String(i)));

    expect(useRecentlyViewedStore.getState().items).toHaveLength(12);
  });
});
