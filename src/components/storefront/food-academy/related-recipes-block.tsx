import Image from "next/image";
import Link from "next/link";
import type { RecipePreview } from "@/services/product-detail-extensions";

interface RelatedRecipesBlockProps {
  recipes: RecipePreview[];
  heading?: string;
  /** Shown instead of rendering nothing when `recipes` is empty — omit to render nothing, matching the original Food Academy usage. */
  emptyMessage?: string;
}

export function RelatedRecipesBlock({ recipes, heading = "Recipes to try", emptyMessage }: RelatedRecipesBlockProps) {
  if (recipes.length === 0) {
    if (!emptyMessage) return null;
    return (
      <div className="mt-8">
        <h2 className="text-h4 font-heading text-charcoal">{heading}</h2>
        <p className="mt-2 text-small text-charcoal/70">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h2 className="text-h4 font-heading text-charcoal">{heading}</h2>
      <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {recipes.map((recipe) => (
          <Link key={recipe.id} href={`/recipes/${recipe.slug}`} className="group block">
            <div className="relative aspect-4/3 overflow-hidden rounded-lg bg-cream">
              <Image src={recipe.imageSrc} alt="" fill className="object-contain p-6" />
            </div>
            <p className="mt-2 text-small font-medium text-charcoal group-hover:underline">{recipe.title}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
