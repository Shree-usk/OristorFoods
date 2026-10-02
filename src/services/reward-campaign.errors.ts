export type RewardCampaignErrorCode = "date_range_invalid";

export class RewardCampaignServiceError extends Error {
  constructor(
    public readonly code: RewardCampaignErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RewardCampaignServiceError";
  }
}

export class CampaignDateRangeInvalidError extends RewardCampaignServiceError {
  constructor() {
    super("date_range_invalid", "The campaign's end date must be after its start date.");
  }
}
