import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { RecentlyViewed, TrackRecentlyViewed } from "@/components/storefront/product/recently-viewed";
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

describe("TrackRecentlyViewed", () => {
  beforeEach(() => {
    localStorage.clear();
    useRecentlyViewedStore.setState({ items: [] });
  });

  it("adds the viewed product to the store on mount", () => {
    render(<TrackRecentlyViewed product={item("1")} />);

    expect(useRecentlyViewedStore.getState().items.map((i) => i.id)).toEqual(["1"]);
  });
});

describe("RecentlyViewed", () => {
  beforeEach(() => {
    localStorage.clear();
    useRecentlyViewedStore.setState({ items: [] });
  });

  it("renders nothing when there are no recently viewed products", () => {
    const { container } = render(<RecentlyViewed excludeProductId="none" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders recently viewed products, excluding the current product", () => {
    useRecentlyViewedStore.setState({ items: [item("1"), item("2")] });

    render(<RecentlyViewed excludeProductId="1" />);

    expect(screen.getByText("Product 2")).toBeInTheDocument();
    expect(screen.queryByText("Product 1")).not.toBeInTheDocument();
  });
});
