export type RedirectErrorCode = "not_found" | "source_path_taken" | "conflict";

export class RedirectServiceError extends Error {
  constructor(
    public readonly code: RedirectErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RedirectServiceError";
  }
}

export class RedirectNotFoundError extends RedirectServiceError {
  constructor() {
    super("not_found", "That redirect could not be found.");
  }
}

export class RedirectSourcePathTakenError extends RedirectServiceError {
  constructor(public readonly sourcePath: string) {
    super("source_path_taken", `A redirect from "${sourcePath}" already exists.`);
  }
}

export class RedirectConflictError extends RedirectServiceError {
  constructor(
    public readonly reason: "self_loop" | "chain",
    message: string,
  ) {
    super("conflict", message);
  }
}
