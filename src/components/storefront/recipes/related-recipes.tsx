import { RecipeCard } from "@/components/storefront/recipes/recipe-card";
import type { RecipeCard as RecipeCardData } from "@/types/recipe";

export function RelatedRecipes({ recipes }: { recipes: RecipeCardData[] }) {
  if (recipes.length === 0) return null;
  return (
    <section aria-labelledby="related-recipes-heading" className="print:hidden">
      <h2 id="related-recipes-heading" className="text-h3 font-heading text-charcoal">
        You might also like
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-3">
        {recipes.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} headingLevel="h3" />
        ))}
      </div>
    </section>
  );
}
