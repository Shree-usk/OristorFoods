import Link from "next/link";
import { formatIngredientLine } from "@/lib/recipe-scaling";
import type { RecipeIngredientItem } from "@/types/recipe";

interface IngredientLinkProps {
  ingredient: RecipeIngredientItem;
  /** Pre-scaled, pre-formatted display quantity, or null when the ingredient has no scalable amount. */
  scaledQuantity: string | null;
}

export function IngredientLink({ ingredient, scaledQuantity }: IngredientLinkProps) {
  const label = formatIngredientLine(ingredient, scaledQuantity);

  if (!ingredient.product) return <span>{label}</span>;

  return (
    <Link href={`/products/${ingredient.product.slug}`} className="text-chilli underline-offset-2 hover:underline">
      {label}
    </Link>
  );
}
