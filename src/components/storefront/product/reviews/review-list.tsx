"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchReviewPage } from "@/lib/api/review-client";
import { formatDisplayDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import { REVIEW_SORTS, type ReviewPage, type ReviewPageQuery, type ReviewSort } from "@/types/review";

import { StarRating } from "./star-rating";

const sortLabels: Record<ReviewSort, string> = {
  recent: "Most recent",
  highest: "Highest rating",
  lowest: "Lowest rating",
};

interface ReviewListProps {
  productSlug: string;
  /** The server-rendered first page (most recent, unfiltered). */
  initialPage: ReviewPage;
  query: ReviewPageQuery;
  onSortChange: (sort: ReviewSort) => void;
  onPageChange: (page: number) => void;
  onClearRating: () => void;
}

export function ReviewList({ productSlug, initialPage, query, onSortChange, onPageChange, onClearRating }: ReviewListProps) {
  const isInitialQuery = query.page === 1 && query.sort === "recent" && query.rating === undefined;
  const { data, isError, isFetching } = useQuery({
    queryKey: ["reviews", productSlug, query],
    queryFn: () => fetchReviewPage(productSlug, query),
    initialData: isInitialQuery ? initialPage : undefined,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const page = data ?? initialPage;

  const from = page.total === 0 ? 0 : (page.page - 1) * page.pageSize + 1;
  const to = Math.min(page.page * page.pageSize, page.total);
  const lastPage = Math.max(1, Math.ceil(page.total / page.pageSize));
  const noun = query.rating ? `${query.rating}-star reviews` : "reviews";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-small text-charcoal/70" aria-live="polite">
          {page.total > 0 ? `Showing ${from}–${to} of ${page.total} ${noun}` : ""}
        </p>
        <div className="flex items-center gap-2">
          {query.rating && (
            <Button type="button" variant="ghost" size="sm" onClick={onClearRating}>
              Clear star filter
            </Button>
          )}
          <Select value={query.sort} onValueChange={(next) => onSortChange(next as ReviewSort)}>
            <SelectTrigger aria-label="Sort reviews">
              <SelectValue>{(selected: ReviewSort | null) => sortLabels[selected ?? "recent"]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {REVIEW_SORTS.map((sort) => (
                <SelectItem key={sort} value={sort}>
                  {sortLabels[sort]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isError && (
        <p role="alert" className="text-small text-destructive">
          Couldn&apos;t load reviews. Please try again.
        </p>
      )}

      {page.items.length === 0 && query.rating ? (
        <p className="text-small text-charcoal/70">No {query.rating}-star reviews yet.</p>
      ) : (
        <ul className={cn("flex flex-col divide-y divide-charcoal/10", isFetching && "opacity-60")}>
          {page.items.map((review) => (
            <li key={review.id} className="py-4">
              <article aria-labelledby={`review-${review.id}-title`}>
                <StarRating rating={review.rating} />
                <h3 id={`review-${review.id}-title`} className="mt-1 font-medium text-charcoal">
                  {review.title}
                </h3>
                <p className="mt-1 text-small whitespace-pre-line text-charcoal">{review.body}</p>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-caption text-charcoal/70">
                  <span>{review.authorName}</span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={review.publishedAt}>{formatDisplayDate(review.publishedAt)}</time>
                  {review.isVerifiedPurchase && <Badge variant="secondary">Verified Purchase</Badge>}
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
