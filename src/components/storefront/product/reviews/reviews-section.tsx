"use client";

import { useState } from "react";

import type { ReviewSummary } from "@/services/product-detail-extensions";
import { REVIEW_PAGE_SIZE, type ReviewPage, type ReviewPageQuery } from "@/types/review";

import { RatingSummary } from "./rating-summary";
import { ReviewList } from "./review-list";

interface ReviewsSectionProps {
  productSlug: string;
  /** Fetched by the PDP (server) through the review summary provider. */
  summary: ReviewSummary | null;
}

/**
 * Owns the list's query state (sort, star filter, page). The histogram in
 * RatingSummary and the controls in ReviewList both change it. Kept in
 * component state, not the URL, so the PDP URL stays canonical.
 */
export function ReviewsSection({ productSlug, summary }: ReviewsSectionProps) {
  const [query, setQuery] = useState<ReviewPageQuery>({ page: 1, pageSize: REVIEW_PAGE_SIZE, sort: "recent" });
  const initialPage: ReviewPage = {
    items: summary?.previewReviews ?? [],
    total: summary?.reviewCount ?? 0,
    page: 1,
    pageSize: REVIEW_PAGE_SIZE,
  };

  return (
    <section aria-labelledby="reviews-heading" className="flex flex-col gap-6">
      <h2 id="reviews-heading" className="text-h3 font-heading text-charcoal">
        Customer Reviews
      </h2>
      <RatingSummary
        summary={summary}
        activeRating={query.rating}
        onSelectRating={(rating) => setQuery((current) => ({ ...current, rating, page: 1 }))}
      />
      {summary && (
        <ReviewList
          productSlug={productSlug}
          initialPage={initialPage}
          query={query}
          onSortChange={(sort) => setQuery((current) => ({ ...current, sort, page: 1 }))}
          onPageChange={(page) => setQuery((current) => ({ ...current, page }))}
          onClearRating={() => setQuery((current) => ({ ...current, rating: undefined, page: 1 }))}
        />
      )}
    </section>
  );
}
