import type { OwnReview, ReviewPage, ReviewPageQuery } from "@/types/review";
import type { ReviewInput } from "@/validation/review.schema";

/**
 * Browser-side wrapper around the product reviews API (STORY-015). Every
 * function throws ReviewApiError on a non-2xx response, carrying the status
 * and any per-field validation errors so the form can show them.
 */
export class ReviewApiError extends Error {
  readonly status: number;
  readonly fieldErrors: Partial<Record<keyof ReviewInput, string[]>>;

  constructor(message: string, status: number, fieldErrors: Partial<Record<keyof ReviewInput, string[]>> = {}) {
    super(message);
    this.name = "ReviewApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

interface ErrorBody {
  error?: string;
  fieldErrors?: Partial<Record<keyof ReviewInput, string[]>>;
}

async function toApiError(response: Response): Promise<ReviewApiError> {
  const body = (await response.json().catch(() => null)) as ErrorBody | null;
  return new ReviewApiError(body?.error ?? `Request failed (${response.status})`, response.status, body?.fieldErrors ?? {});
}

function reviewsUrl(productSlug: string): string {
  return `/api/products/${encodeURIComponent(productSlug)}/reviews`;
}

function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

export async function fetchReviewPage(productSlug: string, query: ReviewPageQuery): Promise<ReviewPage> {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize), sort: query.sort });
  if (query.rating) params.set("rating", String(query.rating));
  const response = await fetch(`${reviewsUrl(productSlug)}?${params.toString()}`);
  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as ReviewPage;
}

export async function fetchMyReview(productSlug: string): Promise<OwnReview | null> {
  const response = await fetch(`${reviewsUrl(productSlug)}/mine`);
  if (!response.ok) throw await toApiError(response);
  return ((await response.json()) as { review: OwnReview | null }).review;
}

export async function postReview(productSlug: string, input: ReviewInput): Promise<OwnReview> {
  const response = await fetch(reviewsUrl(productSlug), jsonInit("POST", input));
  if (!response.ok) throw await toApiError(response);
  return ((await response.json()) as { review: OwnReview }).review;
}

export async function patchReview(productSlug: string, reviewId: string, input: ReviewInput): Promise<OwnReview> {
  const response = await fetch(`${reviewsUrl(productSlug)}/${encodeURIComponent(reviewId)}`, jsonInit("PATCH", input));
  if (!response.ok) throw await toApiError(response);
  return ((await response.json()) as { review: OwnReview }).review;
}

export async function deleteReview(productSlug: string, reviewId: string): Promise<void> {
  const response = await fetch(`${reviewsUrl(productSlug)}/${encodeURIComponent(reviewId)}`, { method: "DELETE" });
  if (!response.ok) throw await toApiError(response);
}
