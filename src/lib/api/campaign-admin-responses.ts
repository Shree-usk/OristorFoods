import { NextResponse } from "next/server";

import { CampaignServiceError, type CampaignErrorCode } from "@/services/campaign.errors";
import { PermissionDeniedError } from "@/services/permission.errors";
import { serverErrorResponse } from "@/lib/api/responses";

const statusByCode: Record<CampaignErrorCode, number> = {
  not_found: 404,
  illegal_edit: 409,
  illegal_send: 409,
};

/** Every /api/admin/marketing/email-sms/* route handler's catch block goes through this — mirrors popup-admin-responses.ts's exact pattern (STORY-050a). */
export function campaignAdminErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof CampaignServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: statusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
