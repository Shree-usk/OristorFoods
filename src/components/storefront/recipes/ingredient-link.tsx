import Link from "next/link";
import type { RecipeIngredientItem } from "@/types/recipe";

interface IngredientLinkProps {
  ingredient: RecipeIngredientItem;
  /** Pre-scaled display quantity, or null when the ingredient has no scalable amount. */
  scaledQuantity: number | null;
}

export function IngredientLink({ ingredient, scaledQuantity }: IngredientLinkProps) {
  const label = scaledQuantity !== null && ingredient.unit
    ? `${scaledQuantity} ${ingredient.unit} ${ingredient.displayText}`
    : ingredient.displayText;

  if (!ingredient.product) return <span>{label}</span>;

  return (
    <Link href={`/products/${ingredient.product.slug}`} className="text-chilli underline-offset-2 hover:underline">
      {label}
    </Link>
  );
}
