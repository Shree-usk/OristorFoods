import { NextResponse } from "next/server";

import { PermissionDeniedError } from "@/services/permission.errors";
import { CouponServiceError, type CouponErrorCode } from "@/services/coupon.errors";
import { serverErrorResponse } from "@/lib/api/responses";

const statusByCode: Partial<Record<CouponErrorCode, number>> = {
  not_found: 404,
  code_taken: 409,
};

/** Every /api/admin/marketing/coupons|promotions/* route handler's catch block goes through this — mirrors popup-admin-responses.ts's exact pattern (STORY-050a). */
export function couponAdminErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof CouponServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: statusByCode[error.code] ?? 400 });
  }
  return serverErrorResponse(error, context);
}
