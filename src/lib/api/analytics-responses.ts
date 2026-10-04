import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { PermissionDeniedError, PermissionServiceError, type PermissionErrorCode } from "@/services/permission.errors";
import { ScheduledReportError, type ScheduledReportErrorCode } from "@/services/scheduled-report.errors";

const permissionStatusByCode: Record<PermissionErrorCode, number> = {
  permission_denied: 403,
  super_administrator_floor: 409,
  last_super_administrator: 409,
};

const scheduledReportStatusByCode: Record<ScheduledReportErrorCode, number> = {
  not_found: 404,
};

/**
 * STORY-059b. Pure-read reports — no story-specific error class
 * exists, only the shared permission errors. STORY-059c's Executive
 * Dashboard (also pure reads) and Scheduled Reports (has its own
 * not-found error) share this same /api/admin/analytics/* route
 * family, so ScheduledReportError is handled here too rather than in
 * a separate one-error-type response file.
 */
export function analyticsErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof PermissionServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: permissionStatusByCode[error.code] });
  }
  if (error instanceof ScheduledReportError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: scheduledReportStatusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
