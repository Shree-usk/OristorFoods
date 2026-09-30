/**
 * The only place reading time is derived. STORY-044's admin builder always
 * computes it from bodyContent, so the stored BlogPost.readingTimeMinutes
 * can never drift from the actual body length — no manual override field
 * in the form, same "compute it, don't ask" rationale as Recipe's
 * computeTotalTimeMinutes (src/lib/recipe-time.ts).
 */
const WORDS_PER_MINUTE = 200;

export function computeReadingTimeMinutes(bodyContent: string): number {
  const wordCount = bodyContent.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
}
