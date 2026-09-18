import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NutritionTable } from "@/components/storefront/product/nutrition-table";

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

describe("NutritionTable", () => {
  it("renders the serving size and every nutrient row", () => {
    render(<NutritionTable nutrition={nutrition} />);

    expect(screen.getByText("Serving size: 1 tsp (5g)")).toBeInTheDocument();
    expect(screen.getByText("Calories")).toBeInTheDocument();
    expect(screen.getByText("18 kcal")).toBeInTheDocument();
    expect(screen.getByText("Sodium")).toBeInTheDocument();
    expect(screen.getByText("2 mg")).toBeInTheDocument();
  });
});
