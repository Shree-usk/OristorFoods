"use client";

import { useState } from "react";
import { ChefNotes } from "@/components/storefront/recipes/chef-notes";
import { IngredientsList } from "@/components/storefront/recipes/ingredients-list";
import { MethodSteps } from "@/components/storefront/recipes/method-steps";
import { NutritionPanel } from "@/components/storefront/recipes/nutrition-panel";
import { RecipePrintShareBar } from "@/components/storefront/recipes/recipe-print-share-bar";
import { ServingSizeAdjuster } from "@/components/storefront/recipes/serving-size-adjuster";
import type { RecipeDetail } from "@/types/recipe";

/**
 * Client Component boundary for the recipe detail page. Owns the
 * `servings` state that the adjuster, ingredients list and nutrition
 * panel all need to stay in sync when the customer scales the recipe.
 * `MethodSteps` and `ChefNotes` don't depend on servings, but live here
 * too (rather than back in the server-rendered page) so they can sit
 * centered alongside the Ingredients column in one cohesive section;
 * `RelatedRecipes` and the rest of the page don't need that and stay
 * server-rendered.
 */
export function RecipeDetailView({ recipe, pageUrl }: { recipe: RecipeDetail; pageUrl: string }) {
  const [servings, setServings] = useState(recipe.servings);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <ServingSizeAdjuster servings={servings} onChange={setServings} />
        <RecipePrintShareBar url={pageUrl} title={recipe.title} recipeSlug={recipe.slug} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-10 border-t border-border-soft pt-8 lg:grid-cols-2 lg:divide-x lg:divide-border-soft">
        <div className="lg:pr-10">
          <h2 className="text-center text-h3 font-heading text-charcoal">Ingredients</h2>
          <div className="mt-4">
            <IngredientsList ingredients={recipe.ingredients} baseServings={recipe.servings} servings={servings} />
          </div>
        </div>
        <div className="lg:pl-10">
          <h2 className="text-center text-h3 font-heading text-charcoal">Preparation Instructions</h2>
          <div className="mt-4">
            <MethodSteps steps={recipe.steps} />
          </div>
        </div>
      </div>

      <div className="mt-10">
        <ChefNotes notes={recipe.chefNotes} />
      </div>

      <div className="mt-10">
        <NutritionPanel nutrition={recipe.nutrition} servings={servings} />
      </div>
    </div>
  );
}
