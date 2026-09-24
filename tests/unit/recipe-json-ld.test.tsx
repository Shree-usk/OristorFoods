import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecipeJsonLd } from "@/components/storefront/recipes/recipe-json-ld";

describe("RecipeJsonLd", () => {
  it("renders a schema.org Recipe script with ingredients and instructions", () => {
    const { container } = render(
      <RecipeJsonLd
        name="Dhal Curry"
        description="A hearty dhal."
        imageUrls={["/img.webp"]}
        totalTimeMinutes={45}
        recipeYield={4}
        ingredientTexts={["2 tbsp Curry Powder"]}
        instructionTexts={["Rinse the rice."]}
        nutritionCalories={420}
        averageRating={4.5}
        ratingCount={12}
      />,
    );
    const script = container.querySelector("script[type='application/ld+json']");
    const json = JSON.parse(script?.textContent ?? "{}");
    expect(json["@type"]).toBe("Recipe");
    expect(json.recipeIngredient).toEqual(["2 tbsp Curry Powder"]);
    expect(json.recipeInstructions[0].text).toBe("Rinse the rice.");
    expect(json.aggregateRating.ratingValue).toBe(4.5);
  });
});
