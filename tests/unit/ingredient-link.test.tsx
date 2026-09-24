import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IngredientLink } from "@/components/storefront/recipes/ingredient-link";

describe("IngredientLink", () => {
  it("renders a link to the product page when a product is linked", () => {
    render(
      <IngredientLink
        ingredient={{ id: "i1", quantity: 2, unit: "tbsp", displayText: "2 tbsp Curry Powder", product: { id: "p1", slug: "curry-powder", name: "Curry Powder" } }}
        scaledQuantity={2}
      />,
    );
    expect(screen.getByRole("link", { name: /curry powder/i })).toHaveAttribute("href", "/products/curry-powder");
  });

  it("renders plain text when no product is linked", () => {
    render(<IngredientLink ingredient={{ id: "i2", quantity: null, unit: null, displayText: "Salt, to taste", product: null }} scaledQuantity={null} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Salt, to taste")).toBeInTheDocument();
  });

  it("uses the ingredient's own displayText, not the linked product's catalog name, even when they differ", () => {
    render(
      <IngredientLink
        ingredient={{ id: "i3", quantity: 2, unit: "tbsp", displayText: "Oristor chilli powder", product: { id: "p3", slug: "chilli-powder-100g", name: "Chilli Powder 100g" } }}
        scaledQuantity={2}
      />,
    );
    expect(screen.getByRole("link")).toHaveTextContent("2 tbsp Oristor chilli powder");
    expect(screen.getByRole("link")).not.toHaveTextContent("Chilli Powder 100g");
  });
});
