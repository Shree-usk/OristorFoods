import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: "unauthenticated" }),
}));

import type { ProductListItem } from "@/types/product";

const { ProductCard } = await import("@/components/storefront/product/product-card");
const { useWishlistStore } = await import("@/lib/stores/wishlist-store");

const baseProduct: ProductListItem = {
  id: "1",
  name: "Roasted Curry Powder",
  href: "/products/roasted-curry-powder",
  imageSrc: "/images/curry-powder.jpg",
  imageAlt: "Roasted Curry Powder",
  price: 650,
  currency: "LKR",
  inStock: true,
};

function renderCard(product: ProductListItem = baseProduct) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ProductCard product={product} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  useWishlistStore.setState({ items: [] });
});

describe("ProductCard", () => {
  it("renders the product name, price, and link", () => {
    renderCard();

    expect(screen.getByText("Roasted Curry Powder")).toBeInTheDocument();
    expect(screen.getByText("LKR 650")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/products/roasted-curry-powder");
  });

  it("shows an out-of-stock badge and hides the price when inStock is false", () => {
    renderCard({ ...baseProduct, inStock: false });

    expect(screen.getByText("Out of stock")).toBeInTheDocument();
    expect(screen.queryByText("LKR 650")).not.toBeInTheDocument();
  });

  it("renders a rating when present", () => {
    renderCard({ ...baseProduct, rating: 4.5, reviewCount: 12 });

    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByText("(12)")).toBeInTheDocument();
  });

  it("renders a wishlist toggle that adds the product to the guest store", () => {
    renderCard();

    screen.getByRole("button", { name: "Add to wishlist" }).click();

    expect(useWishlistStore.getState().items).toEqual(["1"]);
  });

  it("does not navigate when the wishlist toggle is clicked", () => {
    renderCard();

    const button = screen.getByRole("button", { name: "Add to wishlist" });
    const clickEvent = new MouseEvent("click", { bubbles: true, cancelable: true });
    const prevented = !button.dispatchEvent(clickEvent);

    expect(prevented).toBe(true);
  });
});
