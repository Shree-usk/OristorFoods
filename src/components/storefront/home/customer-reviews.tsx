import { Star } from "lucide-react";

import { ScrollReveal } from "@/components/motion";
import { Section } from "@/components/storefront/layout/section";
import type { ReviewData } from "@/types/home";

export function CustomerReviews({ reviews }: { reviews: ReviewData[] }) {
  return (
    <Section className="bg-charcoal text-ivory">
      <h2 className="text-h2 font-heading">What Our Customers Say</h2>
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {reviews.map((review, index) => (
          <ScrollReveal key={review.id} delay={index * 0.05}>
            <div className="flex h-full flex-col rounded-lg border border-ivory/10 p-6">
              <div className="flex gap-0.5" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, starIndex) => (
                  <Star
                    key={starIndex}
                    className={`size-4 ${starIndex < review.rating ? "fill-gold text-gold" : "text-ivory/30"}`}
                  />
                ))}
              </div>
              <span className="sr-only">{review.rating} out of 5 stars</span>
              <p className="mt-4 flex-1 text-body text-ivory/90">&ldquo;{review.quote}&rdquo;</p>
              <p className="mt-4 text-small font-medium">{review.authorName}</p>
              {review.authorLocation && <p className="text-caption text-ivory/70">{review.authorLocation}</p>}
            </div>
          </ScrollReveal>
        ))}
      </div>
    </Section>
  );
}
