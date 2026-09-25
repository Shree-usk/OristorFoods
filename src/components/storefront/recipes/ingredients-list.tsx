import { IngredientLink } from "@/components/storefront/recipes/ingredient-link";
import { formatScaledQuantity, scaleQuantity } from "@/lib/recipe-scaling";
import type { RecipeIngredientItem } from "@/types/recipe";

interface IngredientsListProps {
  ingredients: RecipeIngredientItem[];
  baseServings: number;
  servings: number;
}

export function IngredientsList({ ingredients, baseServings, servings }: IngredientsListProps) {
  return (
    <ul className="space-y-2 text-body text-charcoal">
      {ingredients.map((ingredient) => {
        const scaledQuantity =
          ingredient.quantity !== null
            ? formatScaledQuantity(scaleQuantity(ingredient.quantity, baseServings, servings), ingredient.unit)
            : null;
        return (
          <li key={ingredient.id}>
            <IngredientLink ingredient={ingredient} scaledQuantity={scaledQuantity} />
          </li>
        );
      })}
    </ul>
  );
}
