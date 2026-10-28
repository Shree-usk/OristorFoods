import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { GiftOfferAdminServiceError, type GiftOfferAdminErrorCode } from "@/services/gift-offer-admin.errors";
import { PermissionDeniedError } from "@/services/permission.errors";

const statusByCode: Record<GiftOfferAdminErrorCode, number> = {
  not_found: 404,
  product_already_has_offer: 409,
};

/** Every /api/admin/gift-offers/* route handler's catch block goes through this — mirrors coupon-admin-responses.ts's exact pattern. */
export function giftOfferAdminErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof GiftOfferAdminServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: statusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
