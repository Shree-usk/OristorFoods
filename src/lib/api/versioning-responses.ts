import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { PermissionDeniedError } from "@/services/permission.errors";
import { VersioningError, type VersioningErrorCode } from "@/services/versioning.errors";

const statusByCode: Record<VersioningErrorCode, number> = {
  version_not_found: 404,
};

/** Every /api/admin/cms/* route handler's catch block goes through this. */
export function versioningErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof VersioningError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: statusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
