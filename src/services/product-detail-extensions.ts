import type { PublicQuestion } from "@/types/question";
import type { PublicReview, RatingHistogram } from "@/types/review";

/** A Published review as shown on the PDP. Same shape the reviews API returns. */
export type ReviewPreview = PublicReview;
export interface ReviewSummary {
  averageRating: number;
  reviewCount: number;
  histogram: RatingHistogram;
  /** The first page of Published reviews, most recent first. */
  previewReviews: ReviewPreview[];
}
export type GetReviewSummary = (productId: string) => Promise<ReviewSummary | null>;

/** A Published question with its answer. Same shape the questions API returns. */
export type QaPreview = PublicQuestion;
export interface QaSummary {
  previewItems: QaPreview[];
  totalCount: number;
}
export type GetQaSummary = (productId: string) => Promise<QaSummary | null>;

export interface RecipePreview {
  id: string;
  title: string;
  slug: string;
  imageSrc: string;
}
export interface RecipeSummary {
  recipes: RecipePreview[];
}
export type GetRecipeSummary = (productId: string) => Promise<RecipeSummary | null>;

interface ProductDetailProviders {
  review: GetReviewSummary;
  qa: GetQaSummary;
  recipe: GetRecipeSummary;
}

function defaultProviders(): ProductDetailProviders {
  return { review: async () => null, qa: async () => null, recipe: async () => null };
}

// Kept on globalThis, not in module scope. Providers register at server
// startup from src/instrumentation.ts, which Next.js bundles separately from
// the route code that reads them, so each bundle gets its own copy of this
// module. globalThis is shared by both within the server process (the same
// reason src/lib/db.ts keeps the Prisma client there).
const globalForExtensions = globalThis as unknown as { __oristorProductDetailProviders?: ProductDetailProviders };
const providers = (globalForExtensions.__oristorProductDetailProviders ??= defaultProviders());

/**
 * STORY-015 (Product Reviews & Ratings) registers this through
 * registerReviewProviders() in src/instrumentation.ts, so product.service.ts
 * never imports review code.
 */
export function registerReviewSummaryProvider(provider: GetReviewSummary) {
  providers.review = provider;
}
export function getReviewSummary(productId: string) {
  return providers.review(productId);
}

/** STORY-016 (Product Q&A) — same contract as registerReviewSummaryProvider. */
export function registerQaSummaryProvider(provider: GetQaSummary) {
  providers.qa = provider;
}
export function getQaSummary(productId: string) {
  return providers.qa(productId);
}

/** Epic 04 (Recipes & Food Academy) — same contract as registerReviewSummaryProvider. */
export function registerRecipeSummaryProvider(provider: GetRecipeSummary) {
  providers.recipe = provider;
}
export function getRecipeSummary(productId: string) {
  return providers.recipe(productId);
}

/** Test-only: restores every provider to its default stub. */
export function resetProductDetailExtensionsForTesting() {
  Object.assign(providers, defaultProviders());
}
