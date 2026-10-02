import { NextResponse } from "next/server";

import { PermissionDeniedError } from "@/services/permission.errors";
import { PopupServiceError, type PopupErrorCode } from "@/services/popup.errors";
import { serverErrorResponse } from "@/lib/api/responses";

const statusByCode: Record<PopupErrorCode, number> = {
  not_found: 404,
  illegal_status_transition: 409,
};

/** Every /api/admin/marketing/popups/* route handler's catch block goes through this. */
export function popupAdminErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof PopupServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: statusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
