// tests/unit/cart-line-item.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CartLineItemRow } from "@/components/storefront/cart/cart-line-item";
import type { CartLineItem } from "@/types/cart";

const baseItem: CartLineItem = {
  id: "item-1",
  productId: "product-1",
  productName: "Roasted Curry Powder 100g",
  productSlug: "roasted-curry-powder-100g",
  imageSrc: "/images/products/export/curry-powder.webp",
  imageAlt: "Roasted Curry Powder",
  quantity: 2,
  unitPrice: 25,
  currency: "LKR",
  lineTotal: 50,
  rewardPointsEarned: 10,
  priceChanged: false,
  unavailable: false,
  quantityCapped: false,
  availableQuantity: 100,
};

describe("CartLineItemRow", () => {
  it("renders the product name, quantity, and line total", () => {
    render(<CartLineItemRow item={baseItem} onQuantityChange={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText("Roasted Curry Powder 100g")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("calls onQuantityChange with the incremented value", async () => {
    const user = userEvent.setup();
    const onQuantityChange = vi.fn();
    render(<CartLineItemRow item={baseItem} onQuantityChange={onQuantityChange} onRemove={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /increase quantity/i }));
    expect(onQuantityChange).toHaveBeenCalledWith(3);
  });

  it("calls onRemove when the remove button is clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<CartLineItemRow item={baseItem} onQuantityChange={vi.fn()} onRemove={onRemove} />);

    await user.click(screen.getByRole("button", { name: /remove/i }));
    expect(onRemove).toHaveBeenCalled();
  });

  it("shows a price-changed notice when priceChanged is true", () => {
    render(<CartLineItemRow item={{ ...baseItem, priceChanged: true }} onQuantityChange={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText(/price.*changed/i)).toBeInTheDocument();
  });

  it("shows an unavailable notice when unavailable is true", () => {
    render(<CartLineItemRow item={{ ...baseItem, unavailable: true }} onQuantityChange={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText(/no longer available/i)).toBeInTheDocument();
  });

  it("shows a stock-capped notice and disables increasing past availableQuantity when quantityCapped is true", () => {
    render(<CartLineItemRow item={{ ...baseItem, quantityCapped: true, availableQuantity: 2, quantity: 5 }} onQuantityChange={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText(/only 2 left/i)).toBeInTheDocument();
  });

  it("clamps a decrease straight down to availableQuantity when the line is capped by more than one unit", async () => {
    const user = userEvent.setup();
    const onQuantityChange = vi.fn();
    render(
      <CartLineItemRow
        item={{ ...baseItem, quantityCapped: true, availableQuantity: 2, quantity: 5 }}
        onQuantityChange={onQuantityChange}
        onRemove={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /decrease quantity/i }));
    expect(onQuantityChange).toHaveBeenCalledWith(2);
  });

  it("disables the quantity and remove controls while isMutating is true", () => {
    render(<CartLineItemRow item={baseItem} onQuantityChange={vi.fn()} onRemove={vi.fn()} isMutating />);

    expect(screen.getByRole("button", { name: /increase quantity/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /decrease quantity/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /remove/i })).toBeDisabled();
  });

  it("shows a mutation error message when one is passed", () => {
    render(<CartLineItemRow item={baseItem} onQuantityChange={vi.fn()} onRemove={vi.fn()} error="Only 1 left in stock" />);
    expect(screen.getByText("Only 1 left in stock")).toBeInTheDocument();
  });
});
