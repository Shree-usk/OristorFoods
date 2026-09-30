import { NextResponse } from "next/server";

import { BlogAdminError, type BlogAdminErrorCode } from "@/services/blog-admin.errors";
import { PermissionDeniedError } from "@/services/permission.errors";
import { serverErrorResponse } from "@/lib/api/responses";

const statusByCode: Record<BlogAdminErrorCode, number> = {
  not_found: 404,
  slug_conflict: 409,
  not_draft: 409,
  comment_not_found: 404,
  illegal_comment_transition: 409,
};

/** Every /api/admin/blog/* route handler's catch block goes through this. */
export function blogAdminErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof BlogAdminError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: statusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
