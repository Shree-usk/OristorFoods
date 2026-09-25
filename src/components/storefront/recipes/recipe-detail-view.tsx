"use client";

import { useState } from "react";
import { IngredientsList } from "@/components/storefront/recipes/ingredients-list";
import { NutritionPanel } from "@/components/storefront/recipes/nutrition-panel";
import { RecipePrintShareBar } from "@/components/storefront/recipes/recipe-print-share-bar";
import { ServingSizeAdjuster } from "@/components/storefront/recipes/serving-size-adjuster";
import type { RecipeDetail } from "@/types/recipe";

/**
 * Client Component boundary for the recipe detail page. Owns the
 * `servings` state that the adjuster, ingredients list and nutrition
 * panel all need to stay in sync when the customer scales the recipe.
 * `MethodSteps`, `ChefNotes` and `RelatedRecipes` don't depend on
 * servings, so the page renders them directly and they stay
 * server-rendered.
 */
export function RecipeDetailView({ recipe, pageUrl }: { recipe: RecipeDetail; pageUrl: string }) {
  const [servings, setServings] = useState(recipe.servings);

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <ServingSizeAdjuster servings={servings} onChange={setServings} />
          <RecipePrintShareBar url={pageUrl} title={recipe.title} />
        </div>
        <h2 className="mt-8 text-h3 font-heading text-charcoal">Ingredients</h2>
        <div className="mt-3">
          <IngredientsList ingredients={recipe.ingredients} baseServings={recipe.servings} servings={servings} />
        </div>
      </div>
      <div>
        <NutritionPanel nutrition={recipe.nutrition} servings={servings} />
      </div>
    </div>
  );
}
