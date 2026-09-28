// tests/unit/empty-cart.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyCart } from "@/components/storefront/cart/empty-cart";

describe("EmptyCart", () => {
  it("shows an empty-cart message with a link back to Products", () => {
    render(<EmptyCart />);
    expect(screen.getByText(/cart is empty/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /shop products/i })).toHaveAttribute("href", "/products");
  });
});
