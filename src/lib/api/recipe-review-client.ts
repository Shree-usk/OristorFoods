import type { OwnRecipeReview, RecipeReviewPage, RecipeReviewPageQuery } from "@/types/recipe-review";
import type { RecipeReviewInput } from "@/validation/recipe-review.schema";

/**
 * Browser-side wrapper around the recipe reviews API (STORY-022). Every
 * function throws RecipeReviewApiError on a non-2xx response, carrying the
 * status and any per-field validation errors so the form can show them.
 * Mirrors review-client.ts's shape.
 */
export class RecipeReviewApiError extends Error {
  readonly status: number;
  readonly fieldErrors: Partial<Record<keyof RecipeReviewInput, string[]>>;

  constructor(message: string, status: number, fieldErrors: Partial<Record<keyof RecipeReviewInput, string[]>> = {}) {
    super(message);
    this.name = "RecipeReviewApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

interface ErrorBody {
  error?: string;
  fieldErrors?: Partial<Record<keyof RecipeReviewInput, string[]>>;
}

async function toApiError(response: Response): Promise<RecipeReviewApiError> {
  const body = (await response.json().catch(() => null)) as ErrorBody | null;
  return new RecipeReviewApiError(
    body?.error ?? `Request failed (${response.status})`,
    response.status,
    body?.fieldErrors ?? {},
  );
}

function reviewsUrl(recipeSlug: string): string {
  return `/api/recipes/${encodeURIComponent(recipeSlug)}/reviews`;
}

function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

export async function fetchRecipeReviewPage(recipeSlug: string, query: RecipeReviewPageQuery): Promise<RecipeReviewPage> {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize), sort: query.sort });
  const response = await fetch(`${reviewsUrl(recipeSlug)}?${params.toString()}`);
  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as RecipeReviewPage;
}

export async function fetchMyRecipeReview(recipeSlug: string): Promise<OwnRecipeReview | null> {
  const response = await fetch(`${reviewsUrl(recipeSlug)}/mine`);
  if (!response.ok) throw await toApiError(response);
  return ((await response.json()) as { review: OwnRecipeReview | null }).review;
}

export async function postRecipeReview(recipeSlug: string, input: RecipeReviewInput): Promise<OwnRecipeReview> {
  const response = await fetch(reviewsUrl(recipeSlug), jsonInit("POST", input));
  if (!response.ok) throw await toApiError(response);
  return ((await response.json()) as { review: OwnRecipeReview }).review;
}

export async function patchRecipeReview(recipeSlug: string, reviewId: string, input: RecipeReviewInput): Promise<OwnRecipeReview> {
  const response = await fetch(`${reviewsUrl(recipeSlug)}/${encodeURIComponent(reviewId)}`, jsonInit("PATCH", input));
  if (!response.ok) throw await toApiError(response);
  return ((await response.json()) as { review: OwnRecipeReview }).review;
}

export async function deleteRecipeReview(recipeSlug: string, reviewId: string): Promise<void> {
  const response = await fetch(`${reviewsUrl(recipeSlug)}/${encodeURIComponent(reviewId)}`, { method: "DELETE" });
  if (!response.ok) throw await toApiError(response);
}
