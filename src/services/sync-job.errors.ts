export type SyncJobErrorCode = "not_found" | "max_attempts_exceeded" | "retry_not_yet_allowed";

export class SyncJobError extends Error {
  constructor(
    message: string,
    public readonly code: SyncJobErrorCode,
  ) {
    super(message);
    this.name = "SyncJobError";
  }
}

export class SyncJobNotFoundError extends SyncJobError {
  constructor() {
    super("Sync job not found.", "not_found");
  }
}

export class SyncJobMaxAttemptsExceededError extends SyncJobError {
  constructor(maxAttempts: number) {
    super(`This job has already reached its maximum of ${maxAttempts} attempts.`, "max_attempts_exceeded");
  }
}

export class SyncJobRetryNotYetAllowedError extends SyncJobError {
  constructor(nextRetryAt: Date) {
    super(`This job can't be retried until ${nextRetryAt.toISOString()} (backoff in effect).`, "retry_not_yet_allowed");
  }
}
