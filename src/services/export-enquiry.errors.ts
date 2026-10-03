export type ExportEnquiryErrorCode = "not_found" | "invalid_status_transition" | "not_won";

export class ExportEnquiryError extends Error {
  constructor(
    message: string,
    public readonly code: ExportEnquiryErrorCode,
  ) {
    super(message);
    this.name = "ExportEnquiryError";
  }
}

export class EnquiryNotFoundError extends ExportEnquiryError {
  constructor() {
    super("Export enquiry not found.", "not_found");
  }
}

export class InvalidStatusTransitionError extends ExportEnquiryError {
  constructor(from: string, to: string) {
    super(`Cannot move an enquiry from ${from} to ${to}.`, "invalid_status_transition");
  }
}

export class EnquiryNotWonError extends ExportEnquiryError {
  constructor() {
    super("Only a Won enquiry can be converted into a Distributor Account.", "not_won");
  }
}
