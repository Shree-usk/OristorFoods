export type SeasonalCampaignErrorCode = "not_found" | "illegal_status_transition";

export class SeasonalCampaignServiceError extends Error {
  constructor(
    public readonly code: SeasonalCampaignErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SeasonalCampaignServiceError";
  }
}

export class SeasonalCampaignNotFoundError extends SeasonalCampaignServiceError {
  constructor() {
    super("not_found", "That seasonal campaign could not be found.");
  }
}

export class IllegalSeasonalCampaignStatusTransitionError extends SeasonalCampaignServiceError {
  constructor(
    public readonly from: string,
    public readonly to: string,
  ) {
    super("illegal_status_transition", `Cannot move a seasonal campaign from "${from}" to "${to}".`);
  }
}
