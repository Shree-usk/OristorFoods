"use client";

import { useState } from "react";

import { RECIPE_REVIEW_PAGE_SIZE, type RecipeReviewPage, type RecipeReviewPageQuery } from "@/types/recipe-review";

import { RecipeReviewForm } from "./recipe-review-form";
import { RecipeReviewList } from "./recipe-review-list";

interface RecipeReviewsSectionProps {
  recipeSlug: string;
  /** Fetched by the detail page (Server Component) via recipe-review.service.ts's listApprovedReviewsForRecipe. */
  initialReviewPage: RecipeReviewPage;
}

/**
 * Owns the list's query state (sort, page). Kept in component state, not
 * the URL, so the detail page's URL stays canonical — mirrors
 * reviews-section.tsx.
 */
export function RecipeReviewsSection({ recipeSlug, initialReviewPage }: RecipeReviewsSectionProps) {
  const [query, setQuery] = useState<RecipeReviewPageQuery>({ page: 1, pageSize: RECIPE_REVIEW_PAGE_SIZE, sort: "recent" });

  return (
    <section aria-labelledby="recipe-reviews-heading" className="flex flex-col gap-6">
      <h2 id="recipe-reviews-heading" className="text-h3 font-heading text-charcoal">
        Customer Reviews
      </h2>
      <RecipeReviewList
        recipeSlug={recipeSlug}
        initialPage={initialReviewPage}
        query={query}
        onSortChange={(sort) => setQuery((current) => ({ ...current, sort, page: 1 }))}
        onPageChange={(page) => setQuery((current) => ({ ...current, page }))}
      />
      <RecipeReviewForm recipeSlug={recipeSlug} />
    </section>
  );
}
