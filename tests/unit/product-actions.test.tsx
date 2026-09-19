import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProductActions } from "@/components/storefront/product/product-actions";

describe("ProductActions", () => {
  it("shows an Out of Stock label and disables Add to Cart when out of stock", () => {
    render(<ProductActions productId="p1" inStock={false} />);

    expect(screen.getByRole("button", { name: "Out of Stock" })).toBeDisabled();
  });

  it("disables the wishlist toggle until STORY-013 provides a real implementation", () => {
    render(<ProductActions productId="p1" inStock={true} />);

    expect(screen.getByRole("button", { name: "Add to wishlist" })).toBeDisabled();
  });

  it("disables Add to Cart even when in stock, until STORY-024 provides a real implementation", () => {
    render(<ProductActions productId="p1" inStock={true} />);

    expect(screen.getByRole("button", { name: "Add to Cart" })).toBeDisabled();
  });
});
