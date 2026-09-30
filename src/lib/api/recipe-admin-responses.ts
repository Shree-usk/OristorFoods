import { NextResponse } from "next/server";

import { RecipeAdminError, type RecipeAdminErrorCode } from "@/services/recipe-admin.errors";
import { PermissionDeniedError } from "@/services/permission.errors";
import { serverErrorResponse } from "@/lib/api/responses";

const statusByCode: Record<RecipeAdminErrorCode, number> = {
  not_found: 404,
  slug_conflict: 409,
  illegal_transition: 409,
  not_draft: 409,
  publish_readiness: 422,
};

/** Every /api/admin/recipes/* route handler's catch block goes through this. */
export function recipeAdminErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof RecipeAdminError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: statusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
