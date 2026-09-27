import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RecipePrintShareBar } from "@/components/storefront/recipes/recipe-print-share-bar";

describe("RecipePrintShareBar", () => {
  it("renders a Download PDF link pointing at the recipe's PDF route", () => {
    render(<RecipePrintShareBar url="https://oristor.com/recipes/test-recipe" title="Test Recipe" recipeSlug="test-recipe" />);

    const link = screen.getByRole("link", { name: "Download Test Recipe recipe card as a PDF" });
    expect(link).toHaveAttribute("href", "/api/recipes/test-recipe/pdf");
    expect(link).toHaveAttribute("download");
  });

  it("still renders the existing Print button", () => {
    render(<RecipePrintShareBar url="https://oristor.com/recipes/test-recipe" title="Test Recipe" recipeSlug="test-recipe" />);
    expect(screen.getByRole("button", { name: "Print" })).toBeInTheDocument();
  });
});
