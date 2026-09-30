import { NextResponse } from "next/server";

import { HomepageBuilderError, type HomepageBuilderErrorCode } from "@/services/homepage-builder.errors";
import { PermissionDeniedError } from "@/services/permission.errors";
import { serverErrorResponse } from "@/lib/api/responses";

const statusByCode: Record<HomepageBuilderErrorCode, number> = {
  layout_not_found: 404,
  section_not_found: 404,
  banner_not_found: 404,
  layout_not_draft: 409,
  duplicate_hero_banner_section: 409,
  hero_banner_duplicate_not_allowed: 409,
  no_archived_layout: 404,
};

/** Every /api/admin/homepage-builder/* route handler's catch block goes through this. */
export function homepageBuilderErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof HomepageBuilderError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: statusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
