import type { RecipeCard as RecipeCardData } from "@/types/recipe";
import { RecipeCard } from "./recipe-card";

export function RecipeGrid({ recipes }: { recipes: RecipeCardData[] }) {
  return (
    <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {recipes.map((recipe) => (
        <li key={recipe.id}>
          <RecipeCard recipe={recipe} />
        </li>
      ))}
    </ul>
  );
}
