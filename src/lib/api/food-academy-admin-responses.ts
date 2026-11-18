import { NextResponse } from "next/server";

import { FoodAcademyAdminError, type FoodAcademyAdminErrorCode } from "@/services/food-academy-admin.errors";
import { PermissionDeniedError } from "@/services/permission.errors";
import { serverErrorResponse } from "@/lib/api/responses";

const statusByCode: Record<FoodAcademyAdminErrorCode, number> = {
  category_not_found: 404,
  category_slug_conflict: 409,
  category_in_use: 409,
  entry_not_found: 404,
  entry_slug_conflict: 409,
  entry_publish_readiness: 409,
  entry_requires_sections_for_course: 400,
};

/** Every /api/admin/food-academy/* route handler's catch block goes through this. */
export function foodAcademyAdminErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof FoodAcademyAdminError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: statusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
