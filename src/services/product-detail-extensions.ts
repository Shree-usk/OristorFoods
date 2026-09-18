export interface ReviewPreview {
  id: string;
  authorName: string;
  rating: number;
  title: string;
  body: string;
  createdAt: Date;
}
export interface ReviewSummary {
  averageRating: number;
  reviewCount: number;
  previewReviews: ReviewPreview[];
}
export type GetReviewSummary = (productId: string) => Promise<ReviewSummary | null>;

export interface QaPreview {
  id: string;
  question: string;
  answer: string;
  createdAt: Date;
}
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

let reviewSummaryProvider: GetReviewSummary = async () => null;
let qaSummaryProvider: GetQaSummary = async () => null;
let recipeSummaryProvider: GetRecipeSummary = async () => null;

/**
 * STORY-015 (Product Reviews & Ratings) calls this from its own service
 * module's init to plug real review data into the Product Detail Page,
 * without product.service.ts importing a module that doesn't exist yet.
 */
export function registerReviewSummaryProvider(provider: GetReviewSummary) {
  reviewSummaryProvider = provider;
}
export function getReviewSummary(productId: string) {
  return reviewSummaryProvider(productId);
}

/** STORY-016 (Product Q&A) — same contract as registerReviewSummaryProvider. */
export function registerQaSummaryProvider(provider: GetQaSummary) {
  qaSummaryProvider = provider;
}
export function getQaSummary(productId: string) {
  return qaSummaryProvider(productId);
}

/** Epic 04 (Recipes & Food Academy) — same contract as registerReviewSummaryProvider. */
export function registerRecipeSummaryProvider(provider: GetRecipeSummary) {
  recipeSummaryProvider = provider;
}
export function getRecipeSummary(productId: string) {
  return recipeSummaryProvider(productId);
}

/** Test-only: restores every provider to its default stub. */
export function resetProductDetailExtensionsForTesting() {
  reviewSummaryProvider = async () => null;
  qaSummaryProvider = async () => null;
  recipeSummaryProvider = async () => null;
}
