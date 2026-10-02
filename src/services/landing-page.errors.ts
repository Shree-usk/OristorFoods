export type LandingPageErrorCode = "not_found" | "slug_taken" | "illegal_status_transition";

export class LandingPageServiceError extends Error {
  constructor(
    public readonly code: LandingPageErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "LandingPageServiceError";
  }
}

export class LandingPageNotFoundError extends LandingPageServiceError {
  constructor() {
    super("not_found", "That landing page could not be found.");
  }
}

export class LandingPageBlockNotFoundError extends LandingPageServiceError {
  constructor() {
    super("not_found", "That block could not be found.");
  }
}

export class LandingPageSlugTakenError extends LandingPageServiceError {
  constructor() {
    super("slug_taken", "That URL slug is already in use.");
  }
}

export class IllegalLandingPageStatusTransitionError extends LandingPageServiceError {
  constructor(
    public readonly from: string,
    public readonly to: string,
  ) {
    super("illegal_status_transition", `Cannot move a landing page from "${from}" to "${to}".`);
  }
}
