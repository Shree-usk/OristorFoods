import Image from "next/image";
import Link from "next/link";
import { Clock } from "lucide-react";
import { connection } from "next/server";

import { Badge } from "@/components/ui/badge";
import { ScrollReveal } from "@/components/motion";
import { Section } from "@/components/storefront/layout/section";
import { formatRecipeTime } from "@/lib/recipe-time";
import { getFeaturedRecipes } from "@/services/recipe.service";
import type { RecipeCard as RecipeCardData } from "@/types/recipe";

const MAIN_PLUS_SIDE_COUNT = 5;

function recipeEyebrow(recipe: Pick<RecipeCardData, "categoryName" | "cuisine">) {
  return recipe.cuisine ? `${recipe.categoryName} · ${recipe.cuisine}` : recipe.categoryName;
}

/**
 * Admins choose featured recipes with Recipe.isFeatured (STORY-043's
 * builder). Render per request so a newly featured recipe shows up
 * without a rebuild, and skip the section entirely when none is featured.
 *
 * Layout: the most recently featured recipe (findFeaturedRecipes' own
 * "newest" ordering) becomes the large "main" story; up to 4 more are
 * listed beside it as compact rows. There is no separate admin control
 * for which recipe is "main" — it's always whichever is first in that
 * same ordering an admin already controls via isFeatured.
 */
export async function FeaturedRecipes({ titleOverride }: { titleOverride?: string | null } = {}) {
  await connection();
  const recipes = await getFeaturedRecipes(MAIN_PLUS_SIDE_COUNT);
  if (recipes.length === 0) return null;

  const [main, ...rest] = recipes;

  return (
    <Section className="bg-beige">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <p className="text-caption font-medium tracking-wide text-chilli uppercase">From the Oristor kitchen</p>
          <h2 className="mt-1 text-h2 font-heading font-bold text-charcoal">{titleOverride || "Cook with Oristor"}</h2>
          <Link href="/recipes" className="mt-2 inline-block text-small text-chilli hover:underline">
            View all recipes
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[700px_1fr]">
          <ScrollReveal>
            <article className="group relative">
              <div className="relative aspect-7/4 overflow-hidden rounded-lg bg-cream">
                <Image
                  src={main.heroImage}
                  alt={main.heroImageAlt}
                  fill
                  sizes="(min-width: 1024px) 700px, 100vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  priority
                />
              </div>
              <p className="mt-4 text-small font-medium text-chilli">{recipeEyebrow(main)}</p>
              <h3 className="mt-1 text-h4 font-heading text-charcoal">
                <Link href={main.href} className="after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ring">
                  {main.title}
                </Link>
              </h3>
              <p className="mt-2 line-clamp-2 text-body text-charcoal/80">{main.shortDescription}</p>
              <Link
                href={main.href}
                className="relative z-10 mt-3 inline-flex items-center gap-2 text-small font-medium text-charcoal underline decoration-charcoal/40 underline-offset-4 hover:decoration-charcoal"
              >
                Read More
                <span aria-hidden="true">→</span>
              </Link>
            </article>
          </ScrollReveal>

          <ul className="flex flex-col gap-6">
            {rest.map((recipe, index) => (
              <li key={recipe.id}>
                <ScrollReveal delay={(index + 1) * 0.05}>
                  <article className="group relative flex gap-4">
                    <div className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-cream sm:size-28">
                      <Image src={recipe.heroImage} alt={recipe.heroImageAlt} fill sizes="112px" className="object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-caption font-medium text-chilli">{recipeEyebrow(recipe)}</p>
                      <h3 className="mt-1 text-small font-heading font-semibold text-charcoal">
                        <Link href={recipe.href} className="after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ring">
                          {recipe.title}
                        </Link>
                      </h3>
                      <div className="mt-1 flex items-center gap-2 text-caption text-charcoal/70">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" aria-hidden="true" />
                          <span className="sr-only">Total time: </span>
                          <span>{formatRecipeTime(recipe.totalTimeMinutes)}</span>
                        </span>
                        <Badge variant="outline">
                          <span className="sr-only">Difficulty: </span>
                          <span>{recipe.difficulty}</span>
                        </Badge>
                      </div>
                    </div>
                  </article>
                </ScrollReveal>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
