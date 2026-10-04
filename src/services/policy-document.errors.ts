export type PolicyDocumentErrorCode = "not_found" | "duplicate_slug";

export class PolicyDocumentError extends Error {
  constructor(
    message: string,
    public readonly code: PolicyDocumentErrorCode,
  ) {
    super(message);
    this.name = "PolicyDocumentError";
  }
}

export class PolicyDocumentNotFoundError extends PolicyDocumentError {
  constructor() {
    super("Policy document not found.", "not_found");
  }
}

export class PolicyDocumentDuplicateSlugError extends PolicyDocumentError {
  constructor() {
    super("A policy document with this slug already exists.", "duplicate_slug");
  }
}
