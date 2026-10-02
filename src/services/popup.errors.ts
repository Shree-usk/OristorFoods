export type PopupErrorCode = "not_found" | "illegal_status_transition";

export class PopupServiceError extends Error {
  constructor(
    public readonly code: PopupErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PopupServiceError";
  }
}

export class PopupNotFoundError extends PopupServiceError {
  constructor() {
    super("not_found", "That popup could not be found.");
  }
}

export class IllegalPopupStatusTransitionError extends PopupServiceError {
  constructor(
    public readonly from: string,
    public readonly to: string,
  ) {
    super("illegal_status_transition", `Cannot move a popup from "${from}" to "${to}".`);
  }
}
