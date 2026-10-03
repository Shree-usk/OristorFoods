export type CrmSegmentationErrorCode = "not_found";

export class CrmSegmentationError extends Error {
  constructor(
    message: string,
    public readonly code: CrmSegmentationErrorCode,
  ) {
    super(message);
    this.name = "CrmSegmentationError";
  }
}

export class SegmentNotFoundError extends CrmSegmentationError {
  constructor() {
    super("Saved segment not found.", "not_found");
  }
}
