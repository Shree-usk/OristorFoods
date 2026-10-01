import { NextResponse } from "next/server";

import { ReviewModerationError, type ReviewModerationErrorCode } from "@/services/review-moderation.errors";
import { PermissionDeniedError } from "@/services/permission.errors";
import { serverErrorResponse } from "@/lib/api/responses";

const statusByCode: Record<ReviewModerationErrorCode, number> = {
  not_found: 404,
  illegal_transition: 409,
  feature_not_supported: 422,
  reward_target_invalid: 422,
};

/** Every /api/admin/reviews/* route handler's catch block goes through this. */
export function reviewModerationErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof ReviewModerationError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: statusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
