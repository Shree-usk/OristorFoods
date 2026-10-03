export type VersioningErrorCode = "version_not_found";

export class VersioningError extends Error {
  constructor(
    public readonly code: VersioningErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "VersioningError";
  }
}

export class VersionNotFoundError extends VersioningError {
  constructor() {
    super("version_not_found", "Version not found.");
  }
}
