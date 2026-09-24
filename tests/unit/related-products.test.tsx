import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// ProductCard's wishlist toggle calls useSession (STORY-013).
vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: "unauthenticated" }),
}));

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
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RelatedProducts products={[product]} />
      </QueryClientProvider>,
    );

    expect(screen.getByText("You May Also Like")).toBeInTheDocument();
    expect(screen.getByText("Chilli Powder")).toBeInTheDocument();
  });

  it("renders nothing when there are no related products", () => {
    const { container } = render(<RelatedProducts products={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
