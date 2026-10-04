export type GlossaryErrorCode = "not_found" | "duplicate_term";

export class GlossaryError extends Error {
  constructor(
    message: string,
    public readonly code: GlossaryErrorCode,
  ) {
    super(message);
    this.name = "GlossaryError";
  }
}

export class GlossaryTermNotFoundError extends GlossaryError {
  constructor() {
    super("Glossary term not found.", "not_found");
  }
}

export class GlossaryTermDuplicateError extends GlossaryError {
  constructor() {
    super("A glossary term with this text already exists.", "duplicate_term");
  }
}
