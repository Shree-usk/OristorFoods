/**
 * Typed errors thrown by review.service.ts. Route handlers map `code` to an
 * HTTP status in one place (src/lib/api/review-responses.ts) instead of
 * matching on message strings.
 */
export type ReviewErrorCode =
  | "invalid_input"
  | "product_not_found"
  | "review_not_found"
  | "forbidden"
  | "duplicate"
  | "not_editable"
  | "invalid_transition";

export class ReviewServiceError extends Error {
  readonly code: ReviewErrorCode;

  constructor(code: ReviewErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = new.target.name;
  }
}

export class InvalidReviewInputError extends ReviewServiceError {
  constructor(message: string) {
    super("invalid_input", message);
  }
}

export class ProductNotFoundError extends ReviewServiceError {
  constructor() {
    super("product_not_found", "Product not found");
  }
}

export class ReviewNotFoundError extends ReviewServiceError {
  constructor() {
    super("review_not_found", "Review not found");
  }
}

export class ReviewForbiddenError extends ReviewServiceError {
  constructor() {
    super("forbidden", "You can only change your own review");
  }
}

export class DuplicateReviewError extends ReviewServiceError {
  constructor() {
    super("duplicate", "You have already reviewed this product");
  }
}

export class ReviewNotEditableError extends ReviewServiceError {
  constructor() {
    super("not_editable", "Only reviews that are pending approval can be changed");
  }
}

export class InvalidReviewTransitionError extends ReviewServiceError {
  constructor(from: string, to: string) {
    super("invalid_transition", `A review can't move from ${from} to ${to}`);
  }
}
