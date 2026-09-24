import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

export function formatRating(rating: number): string {
  return Number.isInteger(rating) ? String(rating) : rating.toFixed(1);
}

/** Read-only stars. Screen readers get one "4.3 out of 5 stars" label, not five icons. */
export function StarRating({ rating, className }: { rating: number; className?: string }) {
  const filled = Math.round(rating);
  return (
    <span
      role="img"
      aria-label={`${formatRating(rating)} out of 5 stars`}
      className={cn("inline-flex items-center gap-0.5 text-gold", className)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden="true"
          className={cn("size-4", star <= filled ? "fill-current" : "fill-none text-charcoal/30")}
        />
      ))}
    </span>
  );
}
