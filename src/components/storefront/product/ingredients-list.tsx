import type { ProductDetailIngredient } from "@/services/product.service";

export function IngredientsList({ ingredients }: { ingredients: ProductDetailIngredient[] }) {
  if (ingredients.length === 0) return null;
  return (
    <ul className="list-inside list-disc space-y-1 text-small text-charcoal">
      {ingredients.map((ingredient) => (
        <li key={ingredient.name} className={ingredient.isAllergen ? "font-medium text-destructive" : undefined}>
          {ingredient.name}
          {ingredient.isAllergen && <span className="ml-1 text-caption">(allergen)</span>}
        </li>
      ))}
    </ul>
  );
}
