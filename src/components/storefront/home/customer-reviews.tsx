import { Star } from "lucide-react";

import { ScrollReveal } from "@/components/motion";
import { Container } from "@/components/storefront/layout/container";
import { Section } from "@/components/storefront/layout/section";
import type { ReviewData } from "@/types/home";

/** Seconds per card, so the strip's speed stays visually constant regardless of how many cards (real + repeated) are in the track. */
const SECONDS_PER_CARD = 4;

/**
 * A continuously-scrolling strip needs enough cards on screen to not look
 * sparse — with very few real reviews, repeat the genuine approved set
 * (never fabricate new ones) up to this floor before duplicating again
 * below for the seamless loop.
 */
const MIN_VISIBLE_CARDS = 8;

function ReviewCard({ review }: { review: ReviewData }) {
  return (
    <div className="flex h-full w-72 shrink-0 flex-col rounded-lg border border-border bg-card p-6 shadow-sm sm:w-80">
      <div className="flex gap-0.5" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, starIndex) => (
          <Star
            key={starIndex}
            className={starIndex < review.rating ? "size-4 fill-gold text-gold" : "size-4 text-border"}
          />
        ))}
      </div>
      <span className="sr-only">{review.rating} out of 5 stars</span>
      <p className="mt-4 flex-1 text-body text-charcoal/90">&ldquo;{review.quote}&rdquo;</p>
      <p className="mt-4 text-small font-medium text-charcoal">{review.authorName}</p>
      {review.authorLocation && <p className="text-caption text-charcoal/60">{review.authorLocation}</p>}
    </div>
  );
}

export function CustomerReviews({ reviews, titleOverride }: { reviews: ReviewData[]; titleOverride?: string | null }) {
  const repeatCount = Math.max(1, Math.ceil(MIN_VISIBLE_CARDS / reviews.length));
  const paddedReviews = Array.from({ length: repeatCount }, () => reviews).flat();
  // Rendered twice back-to-back; the keyframes translate exactly -50%
  // (one full copy), so the loop has no visible seam or jump.
  const track = [...paddedReviews, ...paddedReviews];

  const durationSeconds = track.length * SECONDS_PER_CARD;

  return (
    <Section containerSize={false} className="overflow-hidden bg-cream">
      <Container>
        <ScrollReveal>
          <h2 className="text-center text-h2 font-heading text-charcoal">{titleOverride || "What Our Customers Are Saying"}</h2>
        </ScrollReveal>
      </Container>
      <div className="marquee-group relative mt-10 w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]">
        <div className="marquee-track flex w-max gap-6" style={{ "--marquee-duration": `${durationSeconds}s` } as React.CSSProperties}>
          {track.map((review, index) => (
            <ReviewCard key={`${review.id}-${index}`} review={review} />
          ))}
        </div>
      </div>
    </Section>
  );
}
