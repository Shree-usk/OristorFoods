/**
 * Typed error thrown by recipe-bookmark.service.ts. A separate class from
 * recipe-review.errors.ts's RecipeNotFoundError by design — see this task's
 * note in the plan on why no shared error module was introduced.
 */
export type RecipeBookmarkErrorCode = "recipe_not_found";

export class RecipeBookmarkServiceError extends Error {
  readonly code: RecipeBookmarkErrorCode;

  constructor(code: RecipeBookmarkErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = new.target.name;
  }
}

export class RecipeNotFoundError extends RecipeBookmarkServiceError {
  constructor() {
    super("recipe_not_found", "Recipe not found");
  }
}
