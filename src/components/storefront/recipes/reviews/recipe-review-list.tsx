"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchRecipeReviewPage } from "@/lib/api/recipe-review-client";
import { formatDisplayDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import { RECIPE_REVIEW_SORTS, type RecipeReviewPage, type RecipeReviewPageQuery, type RecipeReviewSort } from "@/types/recipe-review";

const sortLabels: Record<RecipeReviewSort, string> = {
  recent: "Most recent",
  highest: "Highest rating",
  lowest: "Lowest rating",
};

/**
 * A single review's star row — a pure `rating: number`, unlike
 * RecipeRatingStars (which also handles the recipe-wide null/empty
 * aggregate case). Local to this file since nothing else needs it.
 */
function ReviewStars({ rating }: { rating: number }) {
  return (
    <span role="img" aria-label={`${rating} out of 5 stars`} className="inline-flex items-center gap-0.5 text-gold">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden="true"
          className={cn("size-4", star <= rating ? "fill-current" : "fill-none text-charcoal/30")}
        />
      ))}
    </span>
  );
}

interface RecipeReviewListProps {
  recipeSlug: string;
  /** The server-rendered first page (most recent). */
  initialPage: RecipeReviewPage;
  query: RecipeReviewPageQuery;
  onSortChange: (sort: RecipeReviewSort) => void;
  onPageChange: (page: number) => void;
}

export function RecipeReviewList({ recipeSlug, initialPage, query, onSortChange, onPageChange }: RecipeReviewListProps) {
  const isInitialQuery = query.page === 1 && query.sort === "recent";
  const { data, isError, isFetching } = useQuery({
    queryKey: ["recipe-reviews", recipeSlug, query],
    queryFn: () => fetchRecipeReviewPage(recipeSlug, query),
    initialData: isInitialQuery ? initialPage : undefined,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const page = data ?? initialPage;

  const from = page.total === 0 ? 0 : (page.page - 1) * page.pageSize + 1;
  const to = Math.min(page.page * page.pageSize, page.total);
  const lastPage = Math.max(1, Math.ceil(page.total / page.pageSize));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-small text-charcoal/70" aria-live="polite">
          {page.total > 0 ? `Showing ${from}–${to} of ${page.total} reviews` : ""}
        </p>
        <Select value={query.sort} onValueChange={(next) => onSortChange(next as RecipeReviewSort)}>
          <SelectTrigger aria-label="Sort reviews">
            <SelectValue>{(selected: RecipeReviewSort | null) => sortLabels[selected ?? "recent"]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {RECIPE_REVIEW_SORTS.map((sort) => (
              <SelectItem key={sort} value={sort}>
                {sortLabels[sort]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isError && (
        <p role="alert" className="text-small text-destructive">
          Couldn&apos;t load reviews. Please try again.
        </p>
      )}

      {page.items.length === 0 ? (
        <p className="text-small text-charcoal/70">No reviews yet.</p>
      ) : (
        <ul className={cn("flex flex-col divide-y divide-charcoal/10", isFetching && "opacity-60")}>
          {page.items.map((review) => (
            <li key={review.id} className="py-4">
              <article aria-labelledby={`recipe-review-${review.id}-author`}>
                <ReviewStars rating={review.rating} />
                {review.reviewText && <p className="mt-1 text-small whitespace-pre-line text-charcoal">{review.reviewText}</p>}
                <p className="mt-2 flex flex-wrap items-center gap-2 text-caption text-charcoal/70">
                  <span id={`recipe-review-${review.id}-author`}>{review.authorName}</span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={review.createdAt}>{formatDisplayDate(review.createdAt)}</time>
                </p>
              </article>
            </li>
          ))}
        </ul>
      )}

      {lastPage > 1 && (
        <nav aria-label="Review pages" className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={query.page <= 1} onClick={() => onPageChange(query.page - 1)}>
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={query.page >= lastPage}
            onClick={() => onPageChange(query.page + 1)}
          >
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}
