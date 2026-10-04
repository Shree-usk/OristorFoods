export type ScheduledReportErrorCode = "not_found";

export class ScheduledReportError extends Error {
  constructor(
    message: string,
    public readonly code: ScheduledReportErrorCode,
  ) {
    super(message);
    this.name = "ScheduledReportError";
  }
}

export class ScheduledReportNotFoundError extends ScheduledReportError {
  constructor() {
    super("Scheduled report not found.", "not_found");
  }
}
