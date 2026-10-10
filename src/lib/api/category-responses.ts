import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { CategoryError, type CategoryErrorCode } from "@/services/category.errors";
import { PermissionDeniedError } from "@/services/permission.errors";

const statusByCode: Record<CategoryErrorCode, number> = {
  category_not_found: 404,
  category_slug_conflict: 409,
  category_parent_cycle: 409,
};

/** Every /api/admin/categories/* route handler's catch block goes through this. */
export function categoryErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof CategoryError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: statusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
