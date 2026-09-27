/**
 * Typed errors thrown by recipe-review.service.ts. Route handlers map `code`
 * to an HTTP status in one place (src/lib/api/recipe-review-responses.ts)
 * instead of matching on message strings.
 */
export type RecipeReviewErrorCode =
  | "invalid_input"
  | "recipe_not_found"
  | "review_not_found"
  | "forbidden"
  | "duplicate"
  | "not_editable"
  | "invalid_transition";

export class RecipeReviewServiceError extends Error {
  readonly code: RecipeReviewErrorCode;

  constructor(code: RecipeReviewErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = new.target.name;
  }
}

export class InvalidRecipeReviewInputError extends RecipeReviewServiceError {
  constructor(message: string) {
    super("invalid_input", message);
  }
}

export class RecipeNotFoundError extends RecipeReviewServiceError {
  constructor() {
    super("recipe_not_found", "Recipe not found");
  }
}

export class RecipeReviewNotFoundError extends RecipeReviewServiceError {
  constructor() {
    super("review_not_found", "Review not found");
  }
}

export class RecipeReviewForbiddenError extends RecipeReviewServiceError {
  constructor() {
    super("forbidden", "You can only change your own review");
  }
}

export class DuplicateRecipeReviewError extends RecipeReviewServiceError {
  constructor() {
    super("duplicate", "You have already reviewed this recipe");
  }
}

export class RecipeReviewNotEditableError extends RecipeReviewServiceError {
  constructor() {
    super("not_editable", "Only reviews that are pending approval can be changed");
  }
}

export class InvalidRecipeReviewTransitionError extends RecipeReviewServiceError {
  constructor(from: string, to: string) {
    super("invalid_transition", `A review can't move from ${from} to ${to}`);
  }
}
