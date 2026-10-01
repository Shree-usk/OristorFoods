import { NextResponse } from "next/server";

import { RecipeQaServiceError, type RecipeQaErrorCode } from "@/services/recipe-qa.errors";

const statusByCode: Record<RecipeQaErrorCode, number> = {
  invalid_input: 400,
  recipe_not_found: 404,
  question_not_found: 404,
  invalid_transition: 409,
};

/** Maps a Recipe Q&A service error to its HTTP response; anything else is rethrown (500). */
export function recipeQaErrorResponse(error: unknown) {
  if (error instanceof RecipeQaServiceError) {
    return NextResponse.json({ error: error.message }, { status: statusByCode[error.code] });
  }
  throw error;
}
