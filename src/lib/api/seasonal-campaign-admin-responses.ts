import { NextResponse } from "next/server";

import { PermissionDeniedError } from "@/services/permission.errors";
import { SeasonalCampaignServiceError, type SeasonalCampaignErrorCode } from "@/services/seasonal-campaign.errors";
import { serverErrorResponse } from "@/lib/api/responses";

const statusByCode: Record<SeasonalCampaignErrorCode, number> = {
  not_found: 404,
  illegal_status_transition: 409,
};

/** Every /api/admin/marketing/seasonal-campaigns/* route handler's catch block goes through this. */
export function seasonalCampaignAdminErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof SeasonalCampaignServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: statusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
