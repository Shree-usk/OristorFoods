import { NextResponse } from "next/server";

import { PermissionDeniedError } from "@/services/permission.errors";
import { MediaServiceError, type MediaErrorCode } from "@/services/media.errors";
import { serverErrorResponse } from "@/lib/api/responses";

const statusByCode: Record<MediaErrorCode, number> = {
  not_found: 404,
  missing_alt_text: 422,
  folder_not_found: 404,
  folder_not_empty: 409,
  upload_validation: 400,
};

/** Every /api/admin/media/* route handler's catch block goes through this. */
export function mediaErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof MediaServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: statusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
