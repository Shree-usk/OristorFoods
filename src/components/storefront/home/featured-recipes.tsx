import Link from "next/link";
import { connection } from "next/server";

import { ScrollReveal } from "@/components/motion";
import { Section } from "@/components/storefront/layout/section";
import { RecipeCard } from "@/components/storefront/recipes/recipe-card";
import { getFeaturedRecipes } from "@/services/recipe.service";

/**
 * Admins choose featured recipes with Recipe.isFeatured (STORY-043's
 * builder). Render per request so a newly featured recipe shows up
 * without a rebuild, and skip the section entirely when none is featured.
 */
export async function FeaturedRecipes() {
  await connection();
  const recipes = await getFeaturedRecipes(4);
  if (recipes.length === 0) return null;

  return (
    <Section className="bg-beige">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-h2 font-heading text-charcoal">Featured Recipes</h2>
        <Link href="/recipes" className="text-small text-chilli hover:underline">
          View all recipes
        </Link>
      </div>
      <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {recipes.map((recipe, index) => (
          <li key={recipe.id}>
            <ScrollReveal delay={index * 0.05}>
              <RecipeCard recipe={recipe} />
            </ScrollReveal>
          </li>
        ))}
      </ul>
    </Section>
  );
}
