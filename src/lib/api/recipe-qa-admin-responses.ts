import { NextResponse } from "next/server";

import { PermissionDeniedError } from "@/services/permission.errors";
import { RecipeQaServiceError, type RecipeQaErrorCode } from "@/services/recipe-qa.errors";
import { serverErrorResponse } from "@/lib/api/responses";

const statusByCode: Record<RecipeQaErrorCode, number> = {
  invalid_input: 400,
  recipe_not_found: 404,
  question_not_found: 404,
  invalid_transition: 409,
};

/** Every /api/admin/recipe-questions/* route handler's catch block goes through this. */
export function recipeQaAdminErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof RecipeQaServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: statusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
