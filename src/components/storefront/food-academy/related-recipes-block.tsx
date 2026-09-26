import Image from "next/image";
import Link from "next/link";
import type { RecipePreview } from "@/services/product-detail-extensions";

export function RelatedRecipesBlock({ recipes }: { recipes: RecipePreview[] }) {
  if (recipes.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="text-h4 font-heading text-charcoal">Recipes to try</h2>
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
