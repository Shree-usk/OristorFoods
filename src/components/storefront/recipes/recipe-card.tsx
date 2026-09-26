import Image from "next/image";
import Link from "next/link";
import { Clock, Play, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatRecipeTime } from "@/lib/recipe-time";
import type { RecipeCard as RecipeCardData } from "@/types/recipe";

interface RecipeCardProps {
  recipe: RecipeCardData;
  /** h3 under a section h2 (the default); h2 where the card sits directly under the page h1. */
  headingLevel?: "h2" | "h3";
}

/**
 * Shared by the Recipe Centre grid and the homepage. No client hooks, so it
 * renders as a Server Component on the homepage and inside the client
 * listing on /recipes. The title link stretches over the whole card.
 */
export function RecipeCard({ recipe, headingLevel: Heading = "h3" }: RecipeCardProps) {
  const hasRating = recipe.avgRating !== null && recipe.ratingCount > 0;

  return (
    <article className="group relative flex h-full flex-col">
      <div className="relative aspect-4/3 overflow-hidden rounded-lg bg-cream">
        <Image
          src={recipe.heroImage}
          alt={recipe.heroImageAlt}
          fill
          sizes="(min-width: 1280px) 25vw, (min-width: 640px) 45vw, 90vw"
          className="object-contain p-6 transition-transform duration-300 group-hover:scale-105"
        />
        {recipe.hasVideo && (
          <span
            role="img"
            aria-label="Video available"
            className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-black/60 text-white"
          >
            <Play className="size-3.5 fill-current" aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="mt-3 text-caption font-medium text-chilli">
        <span>{recipe.categoryName}</span>
        {recipe.cuisine && (
          <>
            <span aria-hidden="true"> · </span>
            <span className="text-charcoal/70">{recipe.cuisine}</span>
          </>
        )}
      </p>
      <Heading className="mt-1 text-h4 font-heading text-charcoal">
        <Link
          href={recipe.href}
          className="after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ring"
        >
          {recipe.title}
        </Link>
      </Heading>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-small text-charcoal/80">
        <span className="flex items-center gap-1">
          <Clock className="size-3.5" aria-hidden="true" />
          <span className="sr-only">Total time: </span>
          <span>{formatRecipeTime(recipe.totalTimeMinutes)}</span>
        </span>
        <Badge variant="outline">
          <span className="sr-only">Difficulty: </span>
          <span>{recipe.difficulty}</span>
        </Badge>
        {hasRating && recipe.avgRating !== null && (
          <span
            role="img"
            aria-label={`Rated ${recipe.avgRating.toFixed(1)} out of 5 from ${recipe.ratingCount} ${recipe.ratingCount === 1 ? "rating" : "ratings"}`}
            className="flex items-center gap-1"
          >
            <Star className="size-3.5 fill-gold text-gold" aria-hidden="true" />
            <span aria-hidden="true">
              {recipe.avgRating.toFixed(1)} ({recipe.ratingCount})
            </span>
          </span>
        )}
      </div>
    </article>
  );
}
