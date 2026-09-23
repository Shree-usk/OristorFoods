"use client";

import { STAR_RATINGS, type RatingSummaryData, type StarRating as StarValue } from "@/types/review";

import { formatRating, StarRating } from "./star-rating";

interface RatingSummaryProps {
  summary: RatingSummaryData | null;
  activeRating?: StarValue;
  onSelectRating: (rating: StarValue) => void;
}

export function RatingSummary({ summary, activeRating, onSelectRating }: RatingSummaryProps) {
  if (!summary) {
    return <p className="text-small text-charcoal/70">No reviews yet. Be the first to review this product.</p>;
  }

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-10">
      <div className="shrink-0">
        <p className="text-charcoal">
          <span className="font-number text-h2">{formatRating(summary.averageRating)}</span>{" "}
          <span className="text-small text-charcoal/70">out of 5</span>
        </p>
        <StarRating rating={summary.averageRating} className="mt-1" />
        <p className="mt-1 text-small text-charcoal/70">
          Based on {summary.reviewCount} {summary.reviewCount === 1 ? "review" : "reviews"}
        </p>
      </div>

      <ul className="flex w-full max-w-md flex-col gap-1" aria-label="Rating breakdown">
        {STAR_RATINGS.map((star) => {
          const count = summary.histogram[star];
          const percent = Math.round((count / summary.reviewCount) * 100);
          return (
            <li key={star}>
              <button
                type="button"
                onClick={() => onSelectRating(star)}
                disabled={count === 0}
                aria-pressed={activeRating === star}
                aria-label={`Show ${star}-star reviews (${count})`}
                className="flex w-full items-center gap-3 rounded-md px-1 py-0.5 text-small text-charcoal hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent aria-pressed:bg-muted"
              >
                <span className="w-12 shrink-0 text-left">{star} star</span>
                <span aria-hidden="true" className="h-2 flex-1 overflow-hidden rounded-full bg-charcoal/10">
                  <span className="block h-full rounded-full bg-gold" style={{ width: `${percent}%` }} />
                </span>
                <span className="w-8 shrink-0 text-right font-number">{count}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
