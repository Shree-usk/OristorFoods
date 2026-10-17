import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IngredientLink } from "@/components/storefront/recipes/ingredient-link";

vi.mock("@/hooks/use-add-to-cart", () => ({
  useAddToCart: () => ({ isAvailable: true, addToCart: vi.fn(), isAdding: false, error: null }),
}));

const BASE_PRODUCT = { id: "p1", slug: "curry-powder", name: "Curry Powder", inStock: true, imageUrl: null, imageAlt: null, price: null };

describe("IngredientLink", () => {
  it("renders a link to the product page when a product is linked", () => {
    render(
      <IngredientLink
        ingredient={{ id: "i1", quantity: 2, unit: "tbsp", displayText: "Curry Powder", product: BASE_PRODUCT }}
        scaledQuantity="2"
      />,
    );
    const links = screen.getAllByRole("link", { name: /curry powder/i });
    expect(links.some((link) => link.getAttribute("href") === "/products/curry-powder")).toBe(true);
    expect(screen.getByText("2 tbsp Curry Powder")).toBeInTheDocument();
  });

  it("renders a compact add-to-cart button for a linked, in-stock product", () => {
    render(
      <IngredientLink
        ingredient={{ id: "i1", quantity: 2, unit: "tbsp", displayText: "Curry Powder", product: BASE_PRODUCT }}
        scaledQuantity="2"
      />,
    );
    expect(screen.getByRole("button", { name: /add to cart/i })).toBeEnabled();
  });

  it("disables the add-to-cart button for an out-of-stock linked product", () => {
    render(
      <IngredientLink
        ingredient={{ id: "i1", quantity: 2, unit: "tbsp", displayText: "Curry Powder", product: { ...BASE_PRODUCT, inStock: false } }}
        scaledQuantity="2"
      />,
    );
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByRole("button")).toHaveTextContent(/out of stock/i);
  });

  it("renders plain text when no product is linked", () => {
    render(<IngredientLink ingredient={{ id: "i2", quantity: null, unit: null, displayText: "Salt, to taste", product: null }} scaledQuantity={null} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Salt, to taste")).toBeInTheDocument();
  });

  it("uses the ingredient's own displayText, not the linked product's catalog name, even when they differ", () => {
    render(
      <IngredientLink
        ingredient={{ id: "i3", quantity: 2, unit: "tbsp", displayText: "Oristor chilli powder", product: { ...BASE_PRODUCT, id: "p3", slug: "chilli-powder-100g", name: "Chilli Powder 100g" } }}
        scaledQuantity="2"
      />,
    );
    expect(screen.getByText("2 tbsp Oristor chilli powder")).toBeInTheDocument();
    expect(screen.queryByText(/Chilli Powder 100g/)).not.toBeInTheDocument();
  });
});
