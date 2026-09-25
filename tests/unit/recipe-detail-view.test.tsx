import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { RecipeDetailView } from "@/components/storefront/recipes/recipe-detail-view";
import { buildRecipeDetail } from "./recipe-fixtures";

describe("RecipeDetailView", () => {
  it("recalculates ingredient quantities when servings is adjusted", async () => {
    const user = userEvent.setup();
    const recipe = buildRecipeDetail({
      servings: 4,
      ingredients: [{ id: "i1", quantity: 2, unit: "cup", displayText: "Rice", product: null }],
    });
    render(<RecipeDetailView recipe={recipe} pageUrl="https://oristor.com/recipes/rice" />);

    expect(screen.getByText(/2 cup Rice/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /increase servings/i }));
    expect(screen.getByText(/2.5 cup Rice/)).toBeInTheDocument();
  });
});
