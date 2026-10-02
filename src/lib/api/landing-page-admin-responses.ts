import { NextResponse } from "next/server";

import { LandingPageServiceError, type LandingPageErrorCode } from "@/services/landing-page.errors";
import { PermissionDeniedError } from "@/services/permission.errors";
import { serverErrorResponse } from "@/lib/api/responses";

const statusByCode: Record<LandingPageErrorCode, number> = {
  not_found: 404,
  slug_taken: 409,
  illegal_status_transition: 409,
};

/** Every /api/admin/marketing/landing-pages/* route handler's catch block goes through this — mirrors popup-admin-responses.ts's exact pattern (STORY-050a). */
export function landingPageAdminErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof LandingPageServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: statusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
