/**
 * Typed errors thrown by review-moderation.service.ts. The unified queue
 * normalizes errors from three different underlying domains (review.errors.ts,
 * recipe-review.errors.ts, blog.service.ts's bare Error) into one error
 * surface so the API layer only has to map one set of codes.
 */
export type ReviewModerationErrorCode = "not_found" | "illegal_transition" | "feature_not_supported" | "reward_target_invalid";

export class ReviewModerationError extends Error {
  constructor(
    public readonly code: ReviewModerationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ReviewModerationError";
  }
}

export class ReviewModerationNotFoundError extends ReviewModerationError {
  constructor() {
    super("not_found", "Item not found.");
  }
}

export class ReviewModerationIllegalTransitionError extends ReviewModerationError {
  constructor(from: string, to: string) {
    super("illegal_transition", `Cannot change status from ${from} to ${to}.`);
  }
}

/** Feature only applies to star-rated content (product/recipe reviews) — a blog comment has no rating/quote to curate. */
export class ReviewModerationFeatureNotSupportedError extends ReviewModerationError {
  constructor() {
    super("feature_not_supported", "Only product and recipe reviews can be featured.");
  }
}

/** A guest-submitted blog comment (customerId null) has no wallet to credit. */
export class ReviewModerationRewardTargetInvalidError extends ReviewModerationError {
  constructor() {
    super("reward_target_invalid", "This item has no registered customer to reward.");
  }
}
