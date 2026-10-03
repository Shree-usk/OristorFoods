import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { PermissionDeniedError } from "@/services/permission.errors";
import { SystemSettingsError, type SystemSettingsErrorCode } from "@/services/system-settings.errors";

const statusByCode: Record<SystemSettingsErrorCode, number> = {
  payment_method_key_conflict: 409,
  feature_flag_key_conflict: 409,
};

/** Every /api/admin/settings/* route handler's catch block goes through this. */
export function systemSettingsErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof SystemSettingsError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: statusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
