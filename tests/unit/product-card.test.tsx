import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProductCard } from "@/components/storefront/product/product-card";
import type { ProductListItem } from "@/types/product";

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

describe("ProductCard", () => {
  it("renders the product name, price, and link", () => {
    render(<ProductCard product={baseProduct} />);

    expect(screen.getByText("Roasted Curry Powder")).toBeInTheDocument();
    expect(screen.getByText("LKR 650")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/products/roasted-curry-powder");
  });

  it("shows an out-of-stock badge and hides the price when inStock is false", () => {
    render(<ProductCard product={{ ...baseProduct, inStock: false }} />);

    expect(screen.getByText("Out of stock")).toBeInTheDocument();
    expect(screen.queryByText("LKR 650")).not.toBeInTheDocument();
  });

  it("renders a rating when present", () => {
    render(<ProductCard product={{ ...baseProduct, rating: 4.5, reviewCount: 12 }} />);

    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByText("(12)")).toBeInTheDocument();
  });
});
