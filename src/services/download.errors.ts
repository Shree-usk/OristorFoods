/**
 * Typed errors thrown by download.service.ts. Route handlers map `code` to
 * an HTTP status in one place (src/lib/api/download-responses.ts) instead
 * of matching on message strings.
 */
export type DownloadErrorCode = "not_found" | "unauthorized";

export class DownloadServiceError extends Error {
  readonly code: DownloadErrorCode;

  constructor(code: DownloadErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = new.target.name;
  }
}

export class DownloadResourceNotFoundError extends DownloadServiceError {
  constructor() {
    super("not_found", "Resource not found");
  }
}

export class DownloadAuthRequiredError extends DownloadServiceError {
  constructor() {
    super("unauthorized", "Sign in to download this resource");
  }
}
