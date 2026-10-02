import { NextResponse } from "next/server";

import { PermissionDeniedError } from "@/services/permission.errors";
import { FraudDetectionServiceError, type FraudDetectionErrorCode } from "@/services/fraud-detection.errors";
import { RewardCampaignServiceError, type RewardCampaignErrorCode } from "@/services/reward-campaign.errors";
import { RewardsServiceError, type RewardsErrorCode } from "@/services/rewards.errors";
import { serverErrorResponse } from "@/lib/api/responses";

const campaignStatusByCode: Record<RewardCampaignErrorCode, number> = {
  date_range_invalid: 400,
};

const fraudStatusByCode: Record<FraudDetectionErrorCode, number> = {
  not_found: 404,
  not_pending: 409,
};

const rewardsStatusByCode: Record<RewardsErrorCode, number> = {
  not_authenticated: 401,
  insufficient_balance: 409,
  exceeds_per_order_cap: 409,
  redemption_unavailable: 409,
  invalid_amount: 400,
  transaction_not_found: 404,
  transaction_not_reversible: 409,
};

/** Every /api/admin/{rewards,referrals}/* route handler's catch block goes through this. */
export function rewardsReferralsAdminErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof RewardCampaignServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: campaignStatusByCode[error.code] });
  }
  if (error instanceof FraudDetectionServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: fraudStatusByCode[error.code] });
  }
  if (error instanceof RewardsServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: rewardsStatusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
