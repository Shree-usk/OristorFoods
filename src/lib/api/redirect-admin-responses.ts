import { NextResponse } from "next/server";

import { PermissionDeniedError } from "@/services/permission.errors";
import { RedirectServiceError, type RedirectErrorCode } from "@/services/redirect.errors";
import { serverErrorResponse } from "@/lib/api/responses";

const statusByCode: Record<RedirectErrorCode, number> = {
  not_found: 404,
  source_path_taken: 409,
  conflict: 409,
};

/** Every /api/admin/seo/redirects/* route handler's catch block goes through this. */
export function redirectAdminErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof RedirectServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: statusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
