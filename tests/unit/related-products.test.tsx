import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RelatedProducts } from "@/components/storefront/product/related-products";
import type { ProductListItem } from "@/types/product";

const product: ProductListItem = {
  id: "1",
  name: "Chilli Powder",
  href: "/products/chilli-powder",
  imageSrc: "/chilli.jpg",
  imageAlt: "Chilli Powder",
  price: 480,
  currency: "LKR",
  inStock: true,
};

describe("RelatedProducts", () => {
  it("renders a heading and a card per related product", () => {
    render(<RelatedProducts products={[product]} />);

    expect(screen.getByText("You May Also Like")).toBeInTheDocument();
    expect(screen.getByText("Chilli Powder")).toBeInTheDocument();
  });

  it("renders nothing when there are no related products", () => {
    const { container } = render(<RelatedProducts products={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
