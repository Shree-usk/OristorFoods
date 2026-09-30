export type RecipeAdminErrorCode = "not_found" | "slug_conflict" | "illegal_transition" | "not_draft" | "publish_readiness";

export class RecipeAdminError extends Error {
  constructor(
    public readonly code: RecipeAdminErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RecipeAdminError";
  }
}

export class RecipeAdminNotFoundError extends RecipeAdminError {
  constructor() {
    super("not_found", "Recipe not found.");
  }
}

export class RecipeAdminSlugConflictError extends RecipeAdminError {
  constructor(public readonly slug: string) {
    super("slug_conflict", `A recipe with slug "${slug}" already exists.`);
  }
}

export class RecipeAdminIllegalTransitionError extends RecipeAdminError {
  constructor(from: string, to: string) {
    super("illegal_transition", `Cannot change recipe status from ${from} to ${to}.`);
  }
}

/** Only a Draft recipe may be deleted — Review/Approved/Published/Archived is a real workflow history, not scratch state. */
export class RecipeAdminNotDraftError extends RecipeAdminError {
  constructor() {
    super("not_draft", "Only a Draft recipe can be deleted.");
  }
}

/** AC: nothing reaches Review/Published without a hero image, at least one ingredient, and at least one step. */
export class RecipePublishReadinessError extends RecipeAdminError {
  constructor(public readonly missing: string[]) {
    super("publish_readiness", `This recipe still needs: ${missing.join(", ")}.`);
  }
}
