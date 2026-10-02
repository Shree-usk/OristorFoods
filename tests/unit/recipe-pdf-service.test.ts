// tests/unit/recipe-pdf-service.test.ts
// @vitest-environment node
import { describe, expect, it } from "vitest";

import { formatPdfIngredientLine, renderRecipePdf } from "@/services/recipe-pdf.service";
import type { RecipeDetail } from "@/types/recipe";

function makeMinimalRecipe(overrides: Partial<RecipeDetail> = {}): RecipeDetail {
  return {
    id: "recipe-1",
    slug: "test-recipe",
    href: "/recipes/test-recipe",
    title: "Test Recipe",
    shortDescription: "A test recipe.",
    heroImage: "/images/products/export/curry-powder.webp",
    heroImageAlt: "Test",
    galleryImageUrls: [],
    categoryName: "Curries",
    categorySlug: "curries",
    cuisine: null,
    difficulty: "Easy",
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    totalTimeMinutes: 30,
    servings: 4,
    avgRating: null,
    ratingCount: 0,
    dietaryTags: [],
    chefNotes: null,
    nutrition: { calories: null, protein: null, carbs: null, fat: null, fiber: null, sodium: null },
    ingredients: [{ id: "ing-1", quantity: null, unit: null, displayText: "Salt, to taste", product: null }],
    steps: [{ stepNumber: 1, instruction: "Combine everything.", imageUrl: null }],
    metaTitle: null,
    metaDescription: null,
    robotsIndex: true,
    robotsFollow: true,
    publishedAt: null,
    relatedRecipes: [],
    video: null,
    ...overrides,
  };
}

describe("formatPdfIngredientLine", () => {
  it("includes the scaled quantity and unit ahead of the ingredient name", () => {
    const line = formatPdfIngredientLine({ id: "ing-1", quantity: 500, unit: "g", displayText: "Prawns, peeled and deveined", product: null });
    expect(line).toBe("500 g Prawns, peeled and deveined");
  });

  it("omits the quantity for an ingredient with no scalable amount", () => {
    const line = formatPdfIngredientLine({ id: "ing-2", quantity: null, unit: null, displayText: "Salt, to taste", product: null });
    expect(line).toBe("Salt, to taste");
  });
});

describe("renderRecipePdf", () => {
  it("renders a non-empty PDF buffer for a fully-populated recipe", async () => {
    const buffer = await renderRecipePdf(makeMinimalRecipe());
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("renders successfully for a recipe with every optional field null/empty", async () => {
    const sparse = makeMinimalRecipe({
      cuisine: null,
      chefNotes: null,
      video: null,
      dietaryTags: [],
      avgRating: null,
      ratingCount: 0,
    });
    const buffer = await renderRecipePdf(sparse);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("renders successfully with multiple ingredients and steps", async () => {
    const recipe = makeMinimalRecipe({
      ingredients: [
        { id: "ing-1", quantity: 1, unit: "kg", displayText: "Chicken, cut into curry pieces", product: null },
        { id: "ing-2", quantity: null, unit: null, displayText: "Salt, to taste", product: null },
      ],
      steps: [
        { stepNumber: 1, instruction: "Marinate the chicken.", imageUrl: null },
        { stepNumber: 2, instruction: "Cook until done.", imageUrl: null },
      ],
    });
    const buffer = await renderRecipePdf(recipe);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
