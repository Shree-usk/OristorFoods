/**
 * Typed errors thrown by recipe-qa.service.ts; route handlers map `code` to
 * an HTTP status in src/lib/api/recipe-qa-responses.ts. Mirrors qa.errors.ts
 * (STORY-016/046) — each domain owns its own error hierarchy in this
 * codebase rather than sharing one across Product/Recipe.
 */
export type RecipeQaErrorCode = "invalid_input" | "recipe_not_found" | "question_not_found" | "invalid_transition";

export class RecipeQaServiceError extends Error {
  readonly code: RecipeQaErrorCode;

  constructor(code: RecipeQaErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = new.target.name;
  }
}

export class InvalidRecipeQuestionInputError extends RecipeQaServiceError {
  constructor(message: string) {
    super("invalid_input", message);
  }
}

export class RecipeQaRecipeNotFoundError extends RecipeQaServiceError {
  constructor() {
    super("recipe_not_found", "Recipe not found");
  }
}

export class RecipeQuestionNotFoundError extends RecipeQaServiceError {
  constructor() {
    super("question_not_found", "Question not found");
  }
}

export class InvalidRecipeQuestionTransitionError extends RecipeQaServiceError {
  constructor(from: string, to: string) {
    super("invalid_transition", `A question can't move from ${from} to ${to}`);
  }
}
