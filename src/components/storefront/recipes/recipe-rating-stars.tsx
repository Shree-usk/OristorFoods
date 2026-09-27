import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

interface RecipeRatingStarsProps {
  avgRating: number | null;
  ratingCount: number;
  className?: string;
}

/**
 * Server Component, display-only (STORY-022). One screen-reader summary
 * label, not five icons read individually — matches
 * product/reviews/star-rating.tsx's existing pattern. Renders "No reviews
 * yet." instead of a 0-star row when the recipe has no Approved reviews,
 * matching Recipe.avgRating's existing nullable-until-rated convention
 * (STORY-017) — never show "0.0 stars" for an unrated recipe.
 */
export function RecipeRatingStars({ avgRating, ratingCount, className }: RecipeRatingStarsProps) {
  if (avgRating === null || ratingCount === 0) {
    return <p className={cn("text-small text-charcoal/70", className)}>No reviews yet.</p>;
  }

  const filled = Math.round(avgRating);
  return (
    <span
      role="img"
      aria-label={`Rated ${avgRating.toFixed(1)} out of 5 from ${ratingCount} ${ratingCount === 1 ? "rating" : "ratings"}`}
      className={cn("inline-flex items-center gap-1 text-gold", className)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden="true"
          className={cn("size-4", star <= filled ? "fill-current" : "fill-none text-charcoal/30")}
        />
      ))}
      <span aria-hidden="true" className="ml-1 text-small text-charcoal">
        {avgRating.toFixed(1)} ({ratingCount})
      </span>
    </span>
  );
}
