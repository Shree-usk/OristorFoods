import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IngredientsList } from "@/components/storefront/product/ingredients-list";

describe("IngredientsList", () => {
  it("renders each ingredient in order and flags allergens", () => {
    render(
      <IngredientsList
        ingredients={[
          { name: "Coriander", isAllergen: false },
          { name: "Peanuts", isAllergen: true },
        ]}
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Coriander");
    expect(items[1]).toHaveTextContent("Peanuts");
    expect(items[1]).toHaveTextContent("(allergen)");
    expect(items[0]).not.toHaveTextContent("(allergen)");
  });

  it("renders nothing for an empty ingredient list", () => {
    const { container } = render(<IngredientsList ingredients={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
