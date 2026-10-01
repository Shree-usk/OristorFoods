export type FraudDetectionErrorCode = "not_found" | "not_pending";

export class FraudDetectionServiceError extends Error {
  constructor(
    public readonly code: FraudDetectionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "FraudDetectionServiceError";
  }
}

export class FraudFlagNotFoundError extends FraudDetectionServiceError {
  constructor() {
    super("not_found", "That fraud flag could not be found.");
  }
}

export class FraudFlagNotPendingError extends FraudDetectionServiceError {
  constructor() {
    super("not_pending", "This fraud flag has already been resolved.");
  }
}
