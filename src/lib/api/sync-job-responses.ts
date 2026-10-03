import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { PermissionDeniedError } from "@/services/permission.errors";
import { SyncJobError, type SyncJobErrorCode } from "@/services/sync-job.errors";

const statusByCode: Record<SyncJobErrorCode, number> = {
  not_found: 404,
  max_attempts_exceeded: 409,
  retry_not_yet_allowed: 429,
};

export function syncJobErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof SyncJobError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: statusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
