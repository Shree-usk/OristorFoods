export type CategoryErrorCode = "category_not_found" | "category_slug_conflict" | "category_parent_cycle";

export class CategoryError extends Error {
  constructor(
    public readonly code: CategoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CategoryError";
  }
}

export class CategoryNotFoundError extends CategoryError {
  constructor() {
    super("category_not_found", "Category not found.");
  }
}

export class CategorySlugConflictError extends CategoryError {
  constructor() {
    super("category_slug_conflict", "A category with this slug already exists.");
  }
}

export class CategoryParentCycleError extends CategoryError {
  constructor() {
    super("category_parent_cycle", "A category can't be its own parent or a descendant of itself.");
  }
}
