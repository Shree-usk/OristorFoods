// tests/unit/wishlist-item-row.test.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WishlistItemRow } from "@/components/storefront/account/wishlist-item-row";
import type { ProductListItem } from "@/types/product";

const baseItem: ProductListItem = {
  id: "1",
  name: "Roasted Curry Powder",
  href: "/products/roasted-curry-powder",
  imageSrc: "/images/curry-powder.jpg",
  imageAlt: "Roasted Curry Powder",
  price: 650,
  currency: "LKR",
  inStock: true,
};

function renderRow(item: ProductListItem = baseItem) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <WishlistItemRow item={item} onRemove={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe("WishlistItemRow", () => {
  it("renders the product name, price, and a link to the product", () => {
    renderRow();

    expect(screen.getByText("Roasted Curry Powder")).toBeInTheDocument();
    expect(screen.getByText("LKR 650")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Roasted Curry Powder/ })[0]).toHaveAttribute("href", "/products/roasted-curry-powder");
  });

  it("shows an out-of-stock badge and disables Move to Cart when inStock is false", () => {
    renderRow({ ...baseItem, inStock: false });

    expect(screen.getByText("Out of stock")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /move to cart/i })).toBeDisabled();
  });

  it("shows a placeholder instead of a broken image when imageSrc is null", () => {
    renderRow({ ...baseItem, imageSrc: null });
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
