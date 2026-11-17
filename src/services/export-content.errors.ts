export type ExportContentErrorCode = "solution_card_not_found" | "process_step_not_found";

export class ExportContentError extends Error {
  constructor(
    public readonly code: ExportContentErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ExportContentError";
  }
}

export class ExportSolutionCardNotFoundError extends ExportContentError {
  constructor() {
    super("solution_card_not_found", "Export solution card not found.");
  }
}

export class ExportProcessStepNotFoundError extends ExportContentError {
  constructor() {
    super("process_step_not_found", "Export process step not found.");
  }
}
