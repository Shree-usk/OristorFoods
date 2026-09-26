import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// ProductCard's wishlist toggle calls useSession (STORY-013) — same mock
// pattern as tests/unit/related-products.test.tsx and product-card.test.tsx.
vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: "unauthenticated" }),
}));

import { RelatedProductsBlock } from "@/components/storefront/food-academy/related-products-block";

const product = {
  id: "1",
  name: "Roasted Curry Powder",
  href: "/products/roasted-curry-powder",
  imageSrc: "/curry-powder.webp",
  imageAlt: "Roasted Curry Powder",
  price: 850,
  currency: "LKR",
  inStock: true,
};

describe("RelatedProductsBlock", () => {
  it("renders a heading and a ProductCard per product", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RelatedProductsBlock products={[product]} />
      </QueryClientProvider>,
    );
    expect(screen.getByRole("heading", { name: /products used/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /roasted curry powder/i })).toHaveAttribute("href", "/products/roasted-curry-powder");
  });

  it("renders nothing when there are no related products", () => {
    const { container } = render(<RelatedProductsBlock products={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
