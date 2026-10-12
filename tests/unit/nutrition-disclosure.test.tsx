import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { NutritionDisclosure } from "@/components/storefront/product/nutrition-disclosure";

const nutrition = {
  servingSize: "1 tsp (5g)",
  calories: 18,
  protein: 0.8,
  fat: 0.7,
  saturatedFat: 0.1,
  carbohydrates: 2.5,
  sugar: 0.3,
  fibre: 1.1,
  sodium: 2,
};

describe("NutritionDisclosure", () => {
  it("hides the nutrition table until the trigger is clicked, then shows it", async () => {
    const user = userEvent.setup();
    render(<NutritionDisclosure nutrition={nutrition} />);

    expect(screen.getByRole("button", { name: "Nutrition Facts" })).toBeInTheDocument();
    expect(screen.queryByText("Serving size: 1 tsp (5g)")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Nutrition Facts" }));

    expect(screen.getByText("Serving size: 1 tsp (5g)")).toBeInTheDocument();
    expect(screen.getByText("Calories")).toBeInTheDocument();
  });
});
