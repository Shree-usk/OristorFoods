export type CampaignErrorCode = "not_found" | "illegal_edit" | "illegal_send";

export class CampaignServiceError extends Error {
  constructor(
    public readonly code: CampaignErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CampaignServiceError";
  }
}

export class CampaignNotFoundError extends CampaignServiceError {
  constructor() {
    super("not_found", "That campaign could not be found.");
  }
}

/** STORY-050d. A Sent campaign's content/schedule can no longer be edited. */
export class IllegalCampaignEditError extends CampaignServiceError {
  constructor() {
    super("illegal_edit", "A sent campaign can no longer be edited.");
  }
}

/** STORY-050d. Only a Draft or Scheduled campaign can be sent. */
export class IllegalCampaignSendError extends CampaignServiceError {
  constructor() {
    super("illegal_send", "This campaign has already been sent.");
  }
}
